// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {InventoryTypes} from "../types/InventoryTypes.sol";

interface IProductBatchFactory {
    event BatchCreated(uint256 indexed batchId, bytes32 indexed merchantIdHash, address unitToken, uint16 profitBps);
    event BatchCategoryConfigured(
        uint256 indexed batchId, bytes32 indexed categoryIdHash, uint256 unitsForSale, uint256 unitCost
    );
    event UnitsPurchased(
        uint256 indexed batchId, bytes32 indexed categoryIdHash, address indexed buyer, uint256 units, uint256 cost
    );
    event ProceedsWithdrawn(uint256 indexed batchId, address indexed to, uint256 amount, address indexed caller);
    event BatchClosed(uint256 indexed batchId, address indexed closedBy);
    event BatchStatusUpdated(uint256 indexed batchId, bool active);
    event SettlementVaultUpdated(address indexed settlementVault);
    event ComplianceUpdated(address indexed compliance);
    event SettledRevenueRecorded(
        uint256 indexed batchId,
        bytes32 indexed periodId,
        bytes32 indexed categoryIdHash,
        uint256 settledAmount,
        uint256 totalSettledRevenue
    );

    function createBatch(
        bytes32 merchantIdHash,
        InventoryTypes.CategoryConfigInput[] calldata categories,
        address purchaseToken,
        uint16 profitBps,
        string calldata tokenName,
        string calldata tokenSymbol,
        address issuer,
        address founder
    ) external returns (uint256 batchId);

    function buyUnits(uint256 batchId, bytes32 categoryIdHash, uint256 units) external;

    function withdrawProceeds(uint256 batchId, uint256 amount, address to) external;

    function closeBatch(uint256 batchId) external;

    function setBatchActive(uint256 batchId, bool active) external;

    function setSettlementVault(address settlementVault) external;

    function setCompliance(address compliance) external;

    function getBatchCategoryHashes(uint256 batchId) external view returns (bytes32[] memory);

    function getCategoryState(uint256 batchId, bytes32 categoryIdHash)
        external
        view
        returns (InventoryTypes.CategoryState memory);

    function isCategoryTokenized(uint256 batchId, bytes32 categoryIdHash) external view returns (bool);

    function isBatchClosed(uint256 batchId) external view returns (bool);

    function recordSettledRevenue(bytes32 periodId, uint256 batchId, bytes32 categoryIdHash, uint256 settledAmount) external;

    function getBatch(uint256 batchId) external view returns (InventoryTypes.Batch memory);
}
