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
    address internal forwarder = makeAddr("forwarder");
    address internal outsider = makeAddr("outsider");
    address internal workflowOwner = makeAddr("workflowOwner");
    uint256 internal batchId1;
    uint256 internal batchId2;

    bytes32 internal constant MERCHANT_ID = keccak256("cafe-merchant-1");
    bytes32 internal constant PRODUCT_ID_A = keccak256("espresso-shot");
    bytes32 internal constant PRODUCT_ID_B = keccak256("latte-shot");

    function setUp() public {
        usdc = new MockUSDC();
        usdc.mint(investor, 10_000_000 * 1e6);
        usdc.mint(address(this), 10_000_000 * 1e6);

        identityRegistry = new IdentityRegistry();
        identityRegistry.addAddress(investor);
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

        batchId1 = _createBatch(PRODUCT_ID_A, "Inventory Unit Token A", "CUTA");
        batchId2 = _createBatch(PRODUCT_ID_B, "Inventory Unit Token B", "CUTB");

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId1, 100);
        factory.buyUnits(batchId2, 80);
        vm.stopPrank();
    }

    function test_VerifiedPeriodSettlesAndInvestorClaims() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 60, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 1);
        coordinator.processPeriodAndSettle(report, batchId1);

        assertEq(settlementVault.claimableGlobalUnits(batchId1), 60);

        InventoryTypes.Batch memory batch = factory.getBatch(batchId1);
        UnitToken unitToken = UnitToken(batch.unitToken);
        assertEq(unitToken.balanceOf(investor), 100 * 1e18);

        uint256 balanceBefore = usdc.balanceOf(investor);
        vm.prank(investor);
        uint256 payout = settlementVault.claim(batchId1, 50);

        assertEq(payout, 50 * 22 * 1e5);
        assertEq(usdc.balanceOf(investor) - balanceBefore, 50 * 22 * 1e5);
        assertEq(unitToken.balanceOf(investor), 50 * 1e18);
        assertEq(settlementVault.claimableGlobalUnits(batchId1), 10);
    }

    function test_UnverifiedPeriodRecordsWithoutSettlement() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.UNVERIFIED, 60, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 2);
        coordinator.processPeriodAndSettle(report, batchId1);

        assertTrue(revenueRegistry.isPeriodRecorded(report.periodId));
        assertEq(settlementVault.claimableGlobalUnits(batchId1), 0);
    }

    function test_CannotRecordSamePeriodTwice() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 40, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 3);
        coordinator.processPeriodAndSettle(report, batchId1);

        vm.expectRevert(bytes("RevenueRegistry: period already recorded"));
        coordinator.processPeriodAndSettle(report, batchId1);
    }

    function test_OracleCanSetPeriodStatusUnverified() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 30, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 30);
        coordinator.processPeriodAndSettle(report, batchId1);

        InventoryTypes.PeriodReport memory storedBefore = revenueRegistry.getPeriod(report.periodId);
        assertEq(uint8(storedBefore.status), uint8(InventoryTypes.PeriodStatus.VERIFIED));

        vm.prank(address(coordinator));
        revenueRegistry.setStatus(report.periodId, InventoryTypes.PeriodStatus.UNVERIFIED);

        InventoryTypes.PeriodReport memory storedAfter = revenueRegistry.getPeriod(report.periodId);
        assertEq(uint8(storedAfter.status), uint8(InventoryTypes.PeriodStatus.UNVERIFIED));
    }

    function test_OnReportSucceedsFromTrustedForwarder() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 30, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 4);
        bytes memory encodedReport = abi.encode(report, batchId1);

        vm.prank(forwarder);
        coordinator.onReport("", encodedReport);

        assertTrue(revenueRegistry.isPeriodRecorded(report.periodId));
        assertEq(settlementVault.claimableGlobalUnits(batchId1), 30);
    }

    function test_OnReportRevertsForNonForwarder() public {
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 30, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 5);

        vm.expectRevert(abi.encodeWithSelector(OracleCoordinator.InvalidSender.selector, outsider, forwarder));
        vm.prank(outsider);
        coordinator.onReport("", abi.encode(report, batchId1));
    }

    function test_SupportsInterfaceForReceiverAndERC165() public view {
        assertTrue(coordinator.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(coordinator.supportsInterface(type(IERC165).interfaceId));
    }

    function test_MetadataValidation_RevertsOnWorkflowIdMismatch() public {
        coordinator.setExpectedWorkflowId(bytes32("expected-workflow-id"));
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 10, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 6);

        bytes32 receivedWorkflowId = bytes32("other-workflow-id");
        bytes memory metadata = _buildMetadata(receivedWorkflowId, bytes10("zawyafi001"), workflowOwner);

        vm.expectRevert(
            abi.encodeWithSelector(
                OracleCoordinator.InvalidWorkflowId.selector, receivedWorkflowId, bytes32("expected-workflow-id")
            )
        );
        vm.prank(forwarder);
        coordinator.onReport(metadata, abi.encode(report, batchId1));
    }

    function test_MetadataValidation_RevertsOnAuthorMismatch() public {
        coordinator.setExpectedAuthor(workflowOwner);
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 10, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 7);

        bytes memory metadata = _buildMetadata(bytes32("workflow-id"), bytes10("zawyafi001"), outsider);

        vm.expectRevert(abi.encodeWithSelector(OracleCoordinator.InvalidAuthor.selector, outsider, workflowOwner));
        vm.prank(forwarder);
        coordinator.onReport(metadata, abi.encode(report, batchId1));
    }

    function test_MetadataValidation_WorkflowNameRequiresAuthorValidation() public {
        coordinator.setExpectedWorkflowName("ZawyafiOracle");
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 10, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 8);
        bytes memory metadata = _buildMetadata(bytes32("workflow-id"), bytes10("zawyafi001"), workflowOwner);

        vm.expectRevert(OracleCoordinator.WorkflowNameRequiresAuthorValidation.selector);
        vm.prank(forwarder);
        coordinator.onReport(metadata, abi.encode(report, batchId1));
    }

    function test_ReportMerchantMismatchReverts() public {
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 10, 0, batchId1, bytes32("merchant-2"), PRODUCT_ID_A, 9);

        vm.expectRevert(abi.encodeWithSelector(OracleCoordinator.MerchantMismatch.selector, report.merchantIdHash, MERCHANT_ID));
        coordinator.processPeriodAndSettle(report, batchId1);
    }

    function test_ReportProductMismatchReverts() public {
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 10, 0, batchId1, MERCHANT_ID, bytes32("product-2"), 10);

        vm.expectRevert(abi.encodeWithSelector(OracleCoordinator.ProductMismatch.selector, report.productIdHash, PRODUCT_ID_A));
        coordinator.processPeriodAndSettle(report, batchId1);
    }

    function test_ReportBatchHashMismatchReverts() public {
        InventoryTypes.PeriodReport memory report =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 10, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 11);
        report.batchHash = keccak256("wrong-batch-hash");

        vm.expectRevert(
            abi.encodeWithSelector(
                OracleCoordinator.BatchHashMismatch.selector, report.batchHash, keccak256(abi.encode(batchId1))
            )
        );
        coordinator.processPeriodAndSettle(report, batchId1);
    }

    function test_LiquidityIsIsolatedPerBatch() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory reportBatch2 =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 40, 0, batchId2, MERCHANT_ID, PRODUCT_ID_B, 12);
        coordinator.processPeriodAndSettle(reportBatch2, batchId2);

        assertTrue(revenueRegistry.isPeriodRecorded(reportBatch2.periodId));
        assertEq(settlementVault.claimableGlobalUnits(batchId2), 0);
    }

    function test_ClaimsConsumeOnlyBatchLiquidity() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId1, 1_000 * 1e6);
        settlementVault.fundBatch(batchId2, 500 * 1e6);

        InventoryTypes.PeriodReport memory reportBatch1 =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 50, 0, batchId1, MERCHANT_ID, PRODUCT_ID_A, 13);
        InventoryTypes.PeriodReport memory reportBatch2 =
            _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 20, 0, batchId2, MERCHANT_ID, PRODUCT_ID_B, 14);

        coordinator.processPeriodAndSettle(reportBatch1, batchId1);
        coordinator.processPeriodAndSettle(reportBatch2, batchId2);

        uint256 batch1BeforeClaim = settlementVault.batchLiquidity(batchId1);
        uint256 batch2BeforeClaim = settlementVault.batchLiquidity(batchId2);
        assertEq(batch1BeforeClaim, 1_000 * 1e6);
        assertEq(batch2BeforeClaim, 500 * 1e6);

        vm.prank(investor);
        settlementVault.claim(batchId1, 10);

        assertEq(settlementVault.batchLiquidity(batchId1), batch1BeforeClaim - (10 * 22 * 1e5));
        assertEq(settlementVault.batchLiquidity(batchId2), batch2BeforeClaim);
    }

    function _createBatch(bytes32 productIdHash, string memory tokenName, string memory tokenSymbol)
        internal
        returns (uint256)
    {
        vm.prank(founder);
        return factory.createBatch(
            MERCHANT_ID, productIdHash, address(usdc), 2 * 1e6, 22 * 1e5, 1_000, tokenName, tokenSymbol, founder, founder
        );
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
        uint256 unitsSold,
        uint256 refundUnits,
        uint256 batchIdForReport,
        bytes32 merchantIdHash,
        bytes32 productIdHash,
        uint64 periodNonce
    ) internal pure returns (InventoryTypes.PeriodReport memory report) {
        uint64 periodStart = 1_700_000_000 + (periodNonce * 1 days);
        uint64 periodEnd = periodStart + uint64(1 days - 1);
        uint256 grossSales = unitsSold * 3 * 1e6;
        uint256 refunds = refundUnits * 3 * 1e6;
        uint256 netSales = grossSales - refunds;
        uint256 netUnitsSold = unitsSold - refundUnits;
        bytes32 periodId = keccak256(abi.encode(merchantIdHash, productIdHash, periodStart, periodEnd));

        report = InventoryTypes.PeriodReport({
            periodId: periodId,
            merchantIdHash: merchantIdHash,
            productIdHash: productIdHash,
            periodStart: periodStart,
            periodEnd: periodEnd,
            grossSales: grossSales,
            refunds: refunds,
            netSales: netSales,
            unitsSold: unitsSold,
            refundUnits: refundUnits,
            netUnitsSold: netUnitsSold,
            eventCount: 42,
            batchHash: keccak256(abi.encode(batchIdForReport)),
            generatedAt: periodEnd + 60,
            status: status,
            riskScore: status == InventoryTypes.PeriodStatus.UNVERIFIED ? 900 : 150,
            reasonCode: status == InventoryTypes.PeriodStatus.UNVERIFIED ? bytes32("REFUND_SPIKE") : bytes32("OK")
        });
    }
}
