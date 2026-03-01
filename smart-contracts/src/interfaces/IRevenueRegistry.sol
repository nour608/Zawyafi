// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {InventoryTypes} from "../types/InventoryTypes.sol";

interface IRevenueRegistry {
    event PeriodRecorded(
        bytes32 indexed periodId,
        bytes32 indexed merchantIdHash,
        bytes32 indexed productIdHash,
        InventoryTypes.PeriodStatus status,
        uint256 netUnitsSold,
        bytes32 batchHash
    );
    event PeriodStatusUpdated(
        bytes32 indexed periodId, InventoryTypes.PeriodStatus previousStatus, InventoryTypes.PeriodStatus newStatus
    );

    function recordPeriod(InventoryTypes.PeriodReport calldata report) external;
    function setStatus(bytes32 periodId, InventoryTypes.PeriodStatus status) external;

    function isPeriodRecorded(bytes32 periodId) external view returns (bool);

    function getPeriod(bytes32 periodId) external view returns (InventoryTypes.PeriodReport memory);
}
