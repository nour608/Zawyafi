// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {InventoryTypes} from "../types/InventoryTypes.sol";

interface IOracleCoordinator {
    event PeriodProcessed(bytes32 indexed periodId, uint256 indexed batchId, bool verified, uint256 unitsSettled);

    function processPeriodAndSettle(InventoryTypes.PeriodReport calldata report, uint256 batchId) external;
}
