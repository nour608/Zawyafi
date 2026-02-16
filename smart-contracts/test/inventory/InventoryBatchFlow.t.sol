// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CurrencyManager} from "../../src/core/CurrencyManager.sol";
import {IdentityRegistry} from "../../src/registry/IdentityRegistry.sol";
import {Compliance} from "../../src/compliance/Compliance.sol";
import {ProductBatchFactory} from "../../src/core/ProductBatchFactory.sol";
import {RevenueRegistry} from "../../src/core/RevenueRegistry.sol";
import {SettlementVault} from "../../src/core/SettlementVault.sol";
import {OracleCoordinator} from "../../src/core/OracleCoordinator.sol";
import {UnitToken} from "../../src/tokens/UnitToken.sol";
import {InventoryTypes} from "../../src/types/InventoryTypes.sol";

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
    uint256 internal batchId;

    bytes32 internal constant MERCHANT_ID = keccak256("cafe-merchant-1");
    bytes32 internal constant PRODUCT_ID = keccak256("espresso-shot");

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
        coordinator = new OracleCoordinator(address(revenueRegistry), address(settlementVault), address(this), address(this));

        revenueRegistry.grantRole(revenueRegistry.ORACLE_ROLE(), address(coordinator));
        settlementVault.grantRole(settlementVault.ORACLE_ROLE(), address(coordinator));

        vm.prank(founder);
        batchId = factory.createBatch(
            MERCHANT_ID,
            PRODUCT_ID,
            address(usdc),
            2 * 1e6,
            22 * 1e5, // 2.2 USDC
            1_000,
            "Inventory Unit Token",
            "CUT",
            founder,
            founder
        );

        vm.startPrank(investor);
        usdc.approve(address(factory), type(uint256).max);
        factory.buyUnits(batchId, 100);
        vm.stopPrank();
    }

    function test_VerifiedPeriodSettlesAndInvestorClaims() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report = _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 60, 0);
        coordinator.processPeriodAndSettle(report, batchId);

        assertEq(settlementVault.claimableGlobalUnits(batchId), 60);

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        UnitToken unitToken = UnitToken(batch.unitToken);
        assertEq(unitToken.balanceOf(investor), 100 * 1e18);

        uint256 balanceBefore = usdc.balanceOf(investor);
        vm.prank(investor);
        uint256 payout = settlementVault.claim(batchId, 50);

        assertEq(payout, 50 * 22 * 1e5);
        assertEq(usdc.balanceOf(investor) - balanceBefore, 50 * 22 * 1e5);
        assertEq(unitToken.balanceOf(investor), 50 * 1e18);
        assertEq(settlementVault.claimableGlobalUnits(batchId), 10);
    }

    function test_UnverifiedPeriodRecordsWithoutSettlement() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report = _buildReport(InventoryTypes.PeriodStatus.UNVERIFIED, 60, 0);
        coordinator.processPeriodAndSettle(report, batchId);

        assertTrue(revenueRegistry.isPeriodRecorded(report.periodId));
        assertEq(settlementVault.claimableGlobalUnits(batchId), 0);
    }

    function test_CannotRecordSamePeriodTwice() public {
        usdc.approve(address(settlementVault), type(uint256).max);
        settlementVault.fundBatch(batchId, 1_000 * 1e6);

        InventoryTypes.PeriodReport memory report = _buildReport(InventoryTypes.PeriodStatus.VERIFIED, 40, 0);
        coordinator.processPeriodAndSettle(report, batchId);

        vm.expectRevert(bytes("RevenueRegistry: period already recorded"));
        coordinator.processPeriodAndSettle(report, batchId);
    }

    function _buildReport(InventoryTypes.PeriodStatus status, uint256 unitsSold, uint256 refundUnits)
        internal
        pure
        returns (InventoryTypes.PeriodReport memory report)
    {
        uint64 periodStart = 1_700_000_000;
        uint64 periodEnd = 1_700_086_400;
        uint256 grossSales = unitsSold * 3 * 1e6;
        uint256 refunds = refundUnits * 3 * 1e6;
        uint256 netSales = grossSales - refunds;
        uint256 netUnitsSold = unitsSold - refundUnits;
        bytes32 periodId = keccak256(abi.encode(MERCHANT_ID, PRODUCT_ID, periodStart, periodEnd));

        report = InventoryTypes.PeriodReport({
            periodId: periodId,
            merchantIdHash: MERCHANT_ID,
            productIdHash: PRODUCT_ID,
            periodStart: periodStart,
            periodEnd: periodEnd,
            grossSales: grossSales,
            refunds: refunds,
            netSales: netSales,
            unitsSold: unitsSold,
            refundUnits: refundUnits,
            netUnitsSold: netUnitsSold,
            eventCount: 42,
            batchHash: keccak256("batch-1"),
            generatedAt: periodEnd + 60,
            status: status,
            riskScore: status == InventoryTypes.PeriodStatus.UNVERIFIED ? 900 : 150,
            reasonCode: status == InventoryTypes.PeriodStatus.UNVERIFIED ? bytes32("REFUND_SPIKE") : bytes32("OK")
        });
    }
}
