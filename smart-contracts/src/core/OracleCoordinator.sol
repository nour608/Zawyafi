// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {InventoryTypes} from "../types/InventoryTypes.sol";
import {IRevenueRegistry} from "../interfaces/IRevenueRegistry.sol";
import {ISettlementVault} from "../interfaces/ISettlementVault.sol";
import {IOracleCoordinator} from "../interfaces/IOracleCoordinator.sol";

contract OracleCoordinator is AccessControl, Pausable, IOracleCoordinator {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IRevenueRegistry public immutable revenueRegistry;
    ISettlementVault public immutable settlementVault;

    constructor(address revenueRegistry_, address settlementVault_, address admin_, address oracle_) {
        require(revenueRegistry_ != address(0), "OracleCoordinator: invalid revenue registry");
        require(settlementVault_ != address(0), "OracleCoordinator: invalid settlement vault");
        require(admin_ != address(0), "OracleCoordinator: invalid admin");

        revenueRegistry = IRevenueRegistry(revenueRegistry_);
        settlementVault = ISettlementVault(settlementVault_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        if (oracle_ != address(0)) {
            _grantRole(ORACLE_ROLE, oracle_);
        }
    }

    function processPeriodAndSettle(InventoryTypes.PeriodReport calldata report, uint256 batchId)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        revenueRegistry.recordPeriod(report);

        uint256 unitsSettled = 0;
        bool verified = report.status == InventoryTypes.PeriodStatus.VERIFIED;
        if (verified && report.netUnitsSold > 0) {
            unitsSettled = settlementVault.settleUnits(report.periodId, batchId, report.netUnitsSold);
        }

        emit PeriodProcessed(report.periodId, batchId, verified, unitsSettled);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
