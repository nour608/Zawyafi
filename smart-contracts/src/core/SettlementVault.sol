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

    mapping(uint256 => uint256) public unitsSettled;
    mapping(uint256 => uint256) public unitsClaimed;
    mapping(uint256 => mapping(bytes32 => bool)) public periodAlreadySettled;

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

        IERC20(batch.purchaseToken).safeTransferFrom(msg.sender, address(this), amount);
        emit BatchFunded(batchId, msg.sender, amount);
    }

    function settleUnits(bytes32 periodId, uint256 batchId, uint256 netUnitsSold)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 unitsSettledNow)
    {
        require(periodId != bytes32(0), "SettlementVault: invalid period");
        require(!periodAlreadySettled[batchId][periodId], "SettlementVault: period already settled");

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        require(batch.id != 0, "SettlementVault: unknown batch");
        require(batch.unitPayout > 0, "SettlementVault: invalid unit payout");

        uint256 remainingUnits = batch.unitsSoldToInvestors - unitsSettled[batchId];
        uint256 liquidityUnits = IERC20(batch.purchaseToken).balanceOf(address(this)) / batch.unitPayout;

        unitsSettledNow = netUnitsSold;
        if (unitsSettledNow > remainingUnits) {
            unitsSettledNow = remainingUnits;
        }
        if (unitsSettledNow > liquidityUnits) {
            unitsSettledNow = liquidityUnits;
        }

        periodAlreadySettled[batchId][periodId] = true;

        if (unitsSettledNow > 0) {
            unitsSettled[batchId] += unitsSettledNow;
        }

        emit UnitsSettled(periodId, batchId, netUnitsSold, unitsSettledNow, liquidityUnits);
    }

    function claim(uint256 batchId, uint256 unitsToRedeem)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 payoutAmount)
    {
        require(unitsToRedeem > 0, "SettlementVault: invalid units");

        InventoryTypes.Batch memory batch = factory.getBatch(batchId);
        require(batch.id != 0, "SettlementVault: unknown batch");

        uint256 availableGlobal = unitsSettled[batchId] - unitsClaimed[batchId];
        require(unitsToRedeem <= availableGlobal, "SettlementVault: insufficient claimable units");

        uint256 accountUnits = IERC20(batch.unitToken).balanceOf(msg.sender) / UNIT;
        require(unitsToRedeem <= accountUnits, "SettlementVault: insufficient unit balance");

        uint256 burnAmount = unitsToRedeem * UNIT;
        payoutAmount = unitsToRedeem * batch.unitPayout;

        unitsClaimed[batchId] += unitsToRedeem;

        UnitToken(batch.unitToken).burnFrom(msg.sender, burnAmount);
        IERC20(batch.purchaseToken).safeTransfer(msg.sender, payoutAmount);

        emit Claimed(batchId, msg.sender, unitsToRedeem, payoutAmount);
    }

    function claimableGlobalUnits(uint256 batchId) external view returns (uint256) {
        return unitsSettled[batchId] - unitsClaimed[batchId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
