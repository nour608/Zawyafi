// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {InventoryTypes} from "../types/InventoryTypes.sol";
import {IProductBatchFactory} from "../interfaces/IProductBatchFactory.sol";
import {ISettlementVault} from "../interfaces/ISettlementVault.sol";
import {UnitToken} from "../tokens/UnitToken.sol";

contract SettlementVault is AccessControl, Pausable, ReentrancyGuard, ISettlementVault {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public constant UNIT = 1e18;

    IProductBatchFactory public immutable factory;

    mapping(uint256 => uint256) public batchLiquidity;
    mapping(uint256 => uint256) public claimedPayoutTotal;
    mapping(uint256 => uint256) private _settledRevenueTotal;
    mapping(uint256 => mapping(bytes32 => mapping(bytes32 => bool))) public periodCategoryAlreadySettled;

    constructor(address factory_, address admin_, address oracle_) {
        require(factory_ != address(0), "SettlementVault: invalid factory");
        require(admin_ != address(0), "SettlementVault: invalid admin");

        factory = IProductBatchFactory(factory_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        if (oracle_ != address(0)) {
            _grantRole(ORACLE_ROLE, oracle_);
        }
    }

    function fundBatch(uint256 batchId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "SettlementVault: invalid amount");

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        require(batch.id != 0, "SettlementVault: unknown batch");

        uint256 beforeBalance = IERC20(batch.purchaseToken).balanceOf(address(this));
        IERC20(batch.purchaseToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount = IERC20(batch.purchaseToken).balanceOf(address(this)) - beforeBalance;
        batchLiquidity[batchId] += receivedAmount;

        emit BatchFunded(batchId, msg.sender, receivedAmount);
    }

    function settleCategoryRevenue(bytes32 periodId, uint256 batchId, bytes32 categoryIdHash, uint256 netSalesAmount)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 settledAmount)
    {
        require(periodId != bytes32(0), "SettlementVault: invalid period");
        require(netSalesAmount > 0, "SettlementVault: invalid net sales");
        require(!periodCategoryAlreadySettled[batchId][categoryIdHash][periodId], "SettlementVault: period settled");
        require(factory.isCategoryTokenized(batchId, categoryIdHash), "SettlementVault: category not tokenized");

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        require(batch.id != 0, "SettlementVault: unknown batch");

        uint256 target = batch.targetPayoutTotal;
        uint256 settledSoFar = _settledRevenueTotal[batchId];
        uint256 targetRemaining = target > settledSoFar ? target - settledSoFar : 0;

        settledAmount = netSalesAmount;
        if (settledAmount > targetRemaining) {
            settledAmount = targetRemaining;
        }

        uint256 liquidityAvailable = batchLiquidity[batchId];
        if (settledAmount > liquidityAvailable) {
            settledAmount = liquidityAvailable;
        }

        periodCategoryAlreadySettled[batchId][categoryIdHash][periodId] = true;

        if (settledAmount > 0) {
            _settledRevenueTotal[batchId] = settledSoFar + settledAmount;
            factory.recordSettledRevenue(periodId, batchId, categoryIdHash, settledAmount);
        }

        uint256 remainingAfterSettle = target > _settledRevenueTotal[batchId] ? target - _settledRevenueTotal[batchId] : 0;

        emit CategoryRevenueSettled(
            periodId, batchId, categoryIdHash, netSalesAmount, settledAmount, remainingAfterSettle
        );
    }

    function claim(uint256 batchId, uint256 sharesToRedeem)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 payoutAmount)
    {
        require(sharesToRedeem > 0, "SettlementVault: invalid shares");

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        require(batch.id != 0, "SettlementVault: unknown batch");

        uint256 shareAmount = sharesToRedeem * UNIT;
        uint256 accountShares = IERC20(batch.unitToken).balanceOf(msg.sender);
        require(shareAmount <= accountShares, "SettlementVault: insufficient shares");

        uint256 totalShares = IERC20(batch.unitToken).totalSupply();
        require(totalShares > 0, "SettlementVault: no shares supply");

        uint256 availablePayout = claimableAmount(batchId);
        require(availablePayout > 0, "SettlementVault: no claimable amount");

        payoutAmount = (availablePayout * shareAmount) / totalShares;
        require(payoutAmount > 0, "SettlementVault: payout too small");

        claimedPayoutTotal[batchId] += payoutAmount;
        batchLiquidity[batchId] -= payoutAmount;

        UnitToken(batch.unitToken).burnFrom(msg.sender, shareAmount);
        IERC20(batch.purchaseToken).safeTransfer(msg.sender, payoutAmount);

        emit Claimed(batchId, msg.sender, sharesToRedeem, payoutAmount);
    }

    function claimableAmount(uint256 batchId) public view returns (uint256) {
        uint256 settled = _settledRevenueTotal[batchId];
        uint256 claimed = claimedPayoutTotal[batchId];
        if (settled <= claimed) {
            return 0;
        }
        uint256 available = settled - claimed;
        uint256 liquidity = batchLiquidity[batchId];
        return available < liquidity ? available : liquidity;
    }

    function isRevenueTargetReached(uint256 batchId) public view returns (bool) {
        return _settledRevenueTotal[batchId] >= targetPayoutTotal(batchId);
    }

    function isBatchFinished(uint256 batchId) external view returns (bool) {
        return factory.isBatchClosed(batchId) && isRevenueTargetReached(batchId);
    }

    function targetPayoutTotal(uint256 batchId) public view returns (uint256) {
        return factory.getBatch(batchId).targetPayoutTotal;
    }

    function settledRevenueTotal(uint256 batchId) external view returns (uint256) {
        return _settledRevenueTotal[batchId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
