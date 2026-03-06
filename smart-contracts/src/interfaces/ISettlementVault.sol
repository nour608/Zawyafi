// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IProductBatchFactory} from "./IProductBatchFactory.sol";

interface ISettlementVault {
    event BatchFunded(uint256 indexed batchId, address indexed from, uint256 amount);
    event CategoryRevenueSettled(
        bytes32 indexed periodId,
        uint256 indexed batchId,
        bytes32 indexed categoryIdHash,
        uint256 netSalesAmount,
        uint256 settledAmount,
        uint256 targetRemaining
    );
    event Claimed(uint256 indexed batchId, address indexed account, uint256 sharesRedeemed, uint256 payoutAmount);

    function fundBatch(uint256 batchId, uint256 amount) external;

    function factory() external view returns (IProductBatchFactory);

    function settleCategoryRevenue(bytes32 periodId, uint256 batchId, bytes32 categoryIdHash, uint256 netSalesAmount)
        external
        returns (uint256 settledAmount);

    function claim(uint256 batchId, uint256 sharesToRedeem) external returns (uint256 payoutAmount);

    function claimableAmount(uint256 batchId) external view returns (uint256);

    function isRevenueTargetReached(uint256 batchId) external view returns (bool);

    function isBatchFinished(uint256 batchId) external view returns (bool);

    function targetPayoutTotal(uint256 batchId) external view returns (uint256);

    function settledRevenueTotal(uint256 batchId) external view returns (uint256);
}
