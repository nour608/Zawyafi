// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {CurrencyManager} from "../../src/core/CurrencyManager.sol";
import {IdentityRegistry} from "../../src/registry/IdentityRegistry.sol";
import {Compliance} from "../../src/compliance/Compliance.sol";
import {ProductBatchFactory} from "../../src/core/ProductBatchFactory.sol";
import {RevenueRegistry} from "../../src/core/RevenueRegistry.sol";
import {SettlementVault} from "../../src/core/SettlementVault.sol";
import {OracleCoordinator} from "../../src/core/OracleCoordinator.sol";
import {UnitToken} from "../../src/tokens/UnitToken.sol";
import {InventoryTypes} from "../../src/types/InventoryTypes.sol";
import {IReceiver} from "../../src/interfaces/IReceiver.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("MockUSDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ProductBatchFlowTest is Test {
    ProductBatchFactory internal factory;
    RevenueRegistry internal revenueRegistry;
    SettlementVault internal settlementVault;
    OracleCoordinator internal coordinator;

    CurrencyManager internal currencyManager;
    IdentityRegistry internal identityRegistry;
    Compliance internal compliance;
    MockUSDC internal usdc;

    address internal founder = makeAddr("founder");
    address internal investor = makeAddr("investor");
    address internal investorTwo = makeAddr("investorTwo");
    address internal forwarder = makeAddr("forwarder");
    address internal outsider = makeAddr("outsider");
    address internal workflowOwner = makeAddr("workflowOwner");

    bytes32 internal constant MERCHANT_ID = keccak256("merchant-1");
    bytes32 internal constant COFFEE = keccak256("Coffee");
    bytes32 internal constant BAKERY = keccak256("Bakery");
    bytes32 internal constant SANDWICHES = keccak256("Sandwiches");

    function setUp() public {
        usdc = new MockUSDC();
        usdc.mint(investor, 10_000_000 * 1e6);
        usdc.mint(investorTwo, 10_000_000 * 1e6);
        usdc.mint(address(this), 10_000_000 * 1e6);

        identityRegistry = new IdentityRegistry();
        identityRegistry.addAddress(investor);
        identityRegistry.addAddress(investorTwo);
        identityRegistry.addAddress(founder);

        compliance = new Compliance(address(this), address(identityRegistry));
        currencyManager = new CurrencyManager();
        currencyManager.addCurrency(address(usdc));

        factory = new ProductBatchFactory(address(currencyManager), address(compliance), address(this));
        settlementVault = new SettlementVault(address(factory), address(this), address(0));
        factory.setSettlementVault(address(settlementVault));

        revenueRegistry = new RevenueRegistry(address(this), address(0));
        coordinator =
            new OracleCoordinator(address(revenueRegistry), address(settlementVault), address(this), address(this), forwarder);

        revenueRegistry.grantRole(revenueRegistry.ORACLE_ROLE(), address(coordinator));
        settlementVault.grantRole(settlementVault.ORACLE_ROLE(), address(coordinator));
        settlementVault.grantRole(settlementVault.ORACLE_ROLE(), address(this));
    }

    function test_CreateBatchSupportsThreeCategories() public {
        uint256 batchId = _createBatch(_threeCategories(), 1_000, "Inventory Unit Token", "IUT");

        bytes32[] memory categoryHashes = factory.getBatchCategoryHashes(batchId);
        assertEq(categoryHashes.length, 3);
        assertEq(categoryHashes[0], COFFEE);
        assertEq(categoryHashes[1], BAKERY);
        assertEq(categoryHashes[2], SANDWICHES);

        InventoryTypes.CategoryState memory category = factory.getCategoryState(batchId, COFFEE);
        assertTrue(category.tokenized);
        assertEq(category.unitsForSale, 5_000);
        assertEq(category.unitCost, 2 * 1e6);
    }

    function test_CreateBatchRejectsDuplicateCategoryHash() public {
        InventoryTypes.CategoryConfigInput[] memory categories = new InventoryTypes.CategoryConfigInput[](2);
        categories[0] = InventoryTypes.CategoryConfigInput({categoryIdHash: COFFEE, unitsForSale: 5, unitCost: 2 * 1e6});
        categories[1] = InventoryTypes.CategoryConfigInput({categoryIdHash: COFFEE, unitsForSale: 4, unitCost: 3 * 1e6});

        vm.expectRevert(bytes("ProductBatchFactory: duplicate category"));
        factory.createBatch(
            MERCHANT_ID, categories, address(usdc), 1_000, "Inventory Unit Token", "IUT", founder, founder
        );
    }

    function test_BuyUnitsUpdatesPrincipalAndTargetWithRoundUp() public {
        InventoryTypes.CategoryConfigInput[] memory categories = new InventoryTypes.CategoryConfigInput[](1);
        categories[0] = InventoryTypes.CategoryConfigInput({categoryIdHash: COFFEE, unitsForSale: 1, unitCost: 1});
        uint256 batchId = _createBatch(categories, 3_333, "Inventory Unit Token", "IUT");

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, COFFEE, 1);
        vm.stopPrank();

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        assertEq(batch.principalSoldTotal, 1);
        assertEq(batch.targetPayoutTotal, 2); // ceil(1 * 3333 / 10000) = 1
    }

    function test_BuyUnitsAutoClosesBatchWhenSoldOut() public {
        InventoryTypes.CategoryConfigInput[] memory categories = new InventoryTypes.CategoryConfigInput[](1);
        categories[0] = InventoryTypes.CategoryConfigInput({categoryIdHash: COFFEE, unitsForSale: 2, unitCost: 2 * 1e6});
        uint256 batchId = _createBatch(categories, 1_000, "Inventory Unit Token", "IUT");

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, COFFEE, 2);
        vm.stopPrank();

        assertTrue(factory.isBatchClosed(batchId));
        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        assertFalse(batch.active);
    }

    function test_AdminCanCloseBatchEarly() public {
        uint256 batchId = _createBatch(_singleCategory(COFFEE, 100, 2 * 1e6), 1_000, "Inventory Unit Token", "IUT");

        factory.closeBatch(batchId);
        assertTrue(factory.isBatchClosed(batchId));

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        vm.expectRevert(bytes("ProductBatchFactory: batch inactive"));
        factory.buyUnits(batchId, COFFEE, 1);
        vm.stopPrank();
    }

    function test_OnReportRevertsForNonTokenizedCategory() public {
        uint256 batchId = _createBatch(_singleCategory(COFFEE, 100, 2 * 1e6), 1_000, "Inventory Unit Token", "IUT");
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, BAKERY, batchId, 1, 10 * 1e6);

        vm.expectRevert(abi.encodeWithSelector(OracleCoordinator.CategoryNotTokenized.selector, BAKERY));
        coordinator.processPeriodAndSettle(report, batchId);
    }

    function test_OnReportSettlesByNetSalesWhenVerified() public {
        uint256 batchId = _createAndBuySingleCategoryBatch();
        _fundBatch(batchId, 300 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 2, 50 * 1e6);
        coordinator.processPeriodAndSettle(report, batchId);

        assertEq(settlementVault.settledRevenueTotal(batchId), 50 * 1e6);
        assertFalse(settlementVault.isRevenueTargetReached(batchId));
    }

    function test_SettlementCappedAtTargetPayout() public {
        uint256 batchId = _createAndBuySingleCategoryBatch();
        _fundBatch(batchId, 500 * 1e6);

        InventoryTypes.PeriodReport memory reportA =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 3, 200 * 1e6);
        coordinator.processPeriodAndSettle(reportA, batchId);

        InventoryTypes.PeriodReport memory reportB =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 4, 100 * 1e6);
        coordinator.processPeriodAndSettle(reportB, batchId);

        assertEq(settlementVault.targetPayoutTotal(batchId), 220 * 1e6);
        assertEq(settlementVault.settledRevenueTotal(batchId), 220 * 1e6);
        assertTrue(settlementVault.isRevenueTargetReached(batchId));
    }

    function test_BatchFinishedRequiresClosedAndTargetReached() public {
        uint256 batchId = _createBatch(_singleCategory(COFFEE, 1_000, 2 * 1e6), 1_000, "Inventory Unit Token", "IUT");

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, COFFEE, 100); // principal 200m, not sold out
        vm.stopPrank();

        _fundBatch(batchId, 300 * 1e6);
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 5, 500 * 1e6);
        coordinator.processPeriodAndSettle(report, batchId);

        assertTrue(settlementVault.isRevenueTargetReached(batchId));
        assertFalse(settlementVault.isBatchFinished(batchId));

        factory.closeBatch(batchId);
        assertTrue(settlementVault.isBatchFinished(batchId));
    }

    function test_ClaimSharedPoolProRata() public {
        uint256 batchId = _createBatch(_singleCategory(COFFEE, 1_000, 1 * 1e6), 1_000, "Inventory Unit Token", "IUT");

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, COFFEE, 100);
        vm.stopPrank();

        vm.startPrank(investorTwo);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, COFFEE, 100);
        vm.stopPrank();

        _fundBatch(batchId, 500 * 1e6);
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 6, 100 * 1e6);
        coordinator.processPeriodAndSettle(report, batchId);

        uint256 balanceBefore = usdc.balanceOf(investor);
        vm.prank(investor);
        uint256 payout = settlementVault.claim(batchId, 50 * 1e6);

        assertEq(payout, 25 * 1e6); // 25% of claimable pool (100m)
        assertEq(usdc.balanceOf(investor) - balanceBefore, 25 * 1e6);
        assertEq(settlementVault.claimableAmount(batchId), 75 * 1e6);
    }

    function test_DuplicateCategorySettlementReverts() public {
        uint256 batchId = _createAndBuySingleCategoryBatch();
        _fundBatch(batchId, 500 * 1e6);

        bytes32 periodId = keccak256("period-duplicate");
        settlementVault.settleCategoryRevenue(periodId, batchId, COFFEE, 10 * 1e6);

        vm.expectRevert(bytes("SettlementVault: period settled"));
        settlementVault.settleCategoryRevenue(periodId, batchId, COFFEE, 10 * 1e6);
    }

    function test_OnReportSucceedsFromTrustedForwarder() public {
        uint256 batchId = _createAndBuySingleCategoryBatch();
        _fundBatch(batchId, 300 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 7, 20 * 1e6);
        bytes memory encodedReport = abi.encode(report, batchId);

        vm.prank(forwarder);
        coordinator.onReport("", encodedReport);

        assertTrue(revenueRegistry.isPeriodRecorded(report.periodId));
        assertEq(settlementVault.settledRevenueTotal(batchId), 20 * 1e6);
    }

    function test_OnReportRevertsForNonForwarder() public {
        uint256 batchId = _createAndBuySingleCategoryBatch();
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, COFFEE, batchId, 8, 20 * 1e6);

        vm.expectRevert(abi.encodeWithSelector(OracleCoordinator.InvalidSender.selector, outsider, forwarder));
        vm.prank(outsider);
        coordinator.onReport("", abi.encode(report, batchId));
    }

    function test_SupportsInterfaceForReceiverAndERC165() public view {
        assertTrue(coordinator.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(coordinator.supportsInterface(type(IERC165).interfaceId));
    }

    function _createAndBuySingleCategoryBatch() internal returns (uint256 batchId) {
        batchId = _createBatch(_singleCategory(COFFEE, 100, 2 * 1e6), 1_000, "Inventory Unit Token", "IUT");
        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, COFFEE, 100);
        vm.stopPrank();
    }

    function _fundBatch(uint256 batchId, uint256 amount) internal {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId, amount);
    }

    function _createBatch(
        InventoryTypes.CategoryConfigInput[] memory categories,
        uint16 profitBps,
        string memory tokenName,
        string memory tokenSymbol
    ) internal returns (uint256) {
        vm.prank(founder);
        return factory.createBatch(MERCHANT_ID, categories, address(usdc), profitBps, tokenName, tokenSymbol, founder, founder);
    }

    function _singleCategory(bytes32 categoryHash, uint256 unitsForSale, uint256 unitCost)
        internal
        pure
        returns (InventoryTypes.CategoryConfigInput[] memory categories)
    {
        categories = new InventoryTypes.CategoryConfigInput[](1);
        categories[0] =
            InventoryTypes.CategoryConfigInput({categoryIdHash: categoryHash, unitsForSale: unitsForSale, unitCost: unitCost});
    }

    function _threeCategories() internal pure returns (InventoryTypes.CategoryConfigInput[] memory categories) {
        categories = new InventoryTypes.CategoryConfigInput[](3);
        categories[0] = InventoryTypes.CategoryConfigInput({categoryIdHash: COFFEE, unitsForSale: 5_000, unitCost: 2 * 1e6});
        categories[1] = InventoryTypes.CategoryConfigInput({categoryIdHash: BAKERY, unitsForSale: 3_334, unitCost: 3 * 1e6});
        categories[2] =
            InventoryTypes.CategoryConfigInput({categoryIdHash: SANDWICHES, unitsForSale: 2_500, unitCost: 4 * 1e6});
    }

    function _buildMetadata(bytes32 workflowId, bytes10 workflowName, address owner)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(workflowId, workflowName, owner);
    }

    function _buildReport(
        InventoryTypes.PeriodStatus status,
        bytes32 categoryHash,
        uint256 batchIdForReport,
        uint64 periodNonce,
        uint256 netSalesAmount
    ) internal pure returns (InventoryTypes.PeriodReport memory report) {
        uint64 periodStart = 1_700_000_000 + (periodNonce * 1 days);
        uint64 periodEnd = periodStart + uint64(1 days - 1);
        bytes32 periodId = keccak256(abi.encode(MERCHANT_ID, categoryHash, periodStart, periodEnd));

        report = InventoryTypes.PeriodReport({
            periodId: periodId,
            merchantIdHash: MERCHANT_ID,
            productIdHash: categoryHash,
            periodStart: periodStart,
            periodEnd: periodEnd,
            grossSales: netSalesAmount,
            refunds: 0,
            netSales: netSalesAmount,
            unitsSold: 1,
            refundUnits: 0,
            netUnitsSold: 1,
            eventCount: 1,
            batchHash: keccak256(abi.encode(batchIdForReport)),
            generatedAt: periodEnd + 60,
            status: status,
            riskScore: status == InventoryTypes.PeriodStatus.UNVERIFIED ? 900 : 100,
            reasonCode: status == InventoryTypes.PeriodStatus.UNVERIFIED ? bytes32("UNVERIFIED") : bytes32("OK")
        });
    }
}
