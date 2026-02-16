// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {InventoryTypes} from "../types/InventoryTypes.sol";
import {IRevenueRegistry} from "../interfaces/IRevenueRegistry.sol";

contract RevenueRegistry is AccessControl, Pausable, IRevenueRegistry {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    mapping(bytes32 => InventoryTypes.PeriodReport) private _reports;
    mapping(bytes32 => bool) private _recorded;

    constructor(address admin_, address oracle_) {
        require(admin_ != address(0), "RevenueRegistry: invalid admin");

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        if (oracle_ != address(0)) {
            _grantRole(ORACLE_ROLE, oracle_);
        }
    }

    function recordPeriod(InventoryTypes.PeriodReport calldata report) external onlyRole(ORACLE_ROLE) whenNotPaused {
        require(report.periodId != bytes32(0), "RevenueRegistry: invalid period id");
        require(!_recorded[report.periodId], "RevenueRegistry: period already recorded");
        require(report.periodEnd >= report.periodStart, "RevenueRegistry: invalid period range");
        require(report.generatedAt >= report.periodEnd, "RevenueRegistry: stale generatedAt");
        require(report.refunds <= report.grossSales, "RevenueRegistry: refunds exceed gross");
        require(report.netSales == report.grossSales - report.refunds, "RevenueRegistry: netSales mismatch");
        require(report.refundUnits <= report.unitsSold, "RevenueRegistry: refundUnits exceed sold");
        require(report.netUnitsSold == report.unitsSold - report.refundUnits, "RevenueRegistry: netUnitsSold mismatch");

        _recorded[report.periodId] = true;
        _reports[report.periodId] = report;

        emit PeriodRecorded(
            report.periodId,
            report.merchantIdHash,
            report.productIdHash,
            report.status,
            report.netUnitsSold,
            report.batchHash
        );
    }

    function isPeriodRecorded(bytes32 periodId) external view returns (bool) {
        return _recorded[periodId];
    }

    function getPeriod(bytes32 periodId) external view returns (InventoryTypes.PeriodReport memory) {
        require(_recorded[periodId], "RevenueRegistry: period not found");
        return _reports[periodId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
