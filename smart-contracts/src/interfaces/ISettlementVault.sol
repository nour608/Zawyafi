// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IProductBatchFactory} from "./IProductBatchFactory.sol";

interface ISettlementVault {
    event BatchFunded(uint256 indexed batchId, address indexed from, uint256 amount);
    event UnitsSettled(
        bytes32 indexed periodId, uint256 indexed batchId, uint256 netUnitsSold, uint256 unitsSettled, uint256 liquidityUnits
    );
    event Claimed(uint256 indexed batchId, address indexed account, uint256 unitsRedeemed, uint256 payoutAmount);

    function fundBatch(uint256 batchId, uint256 amount) external;

    function factory() external view returns (IProductBatchFactory);

    function settleUnits(bytes32 periodId, uint256 batchId, uint256 netUnitsSold) external returns (uint256 unitsSettled);

    function claim(uint256 batchId, uint256 unitsToRedeem) external returns (uint256 payoutAmount);

    function claimableGlobalUnits(uint256 batchId) external view returns (uint256);
}
