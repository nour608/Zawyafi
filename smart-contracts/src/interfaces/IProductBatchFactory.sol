// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {InventoryTypes} from "../types/InventoryTypes.sol";

interface IProductBatchFactory {
    event BatchCreated(
        uint256 indexed batchId, bytes32 indexed merchantIdHash, bytes32 indexed productIdHash, address unitToken
    );
    event UnitsPurchased(uint256 indexed batchId, address indexed buyer, uint256 units, uint256 cost);
    event ProceedsWithdrawn(uint256 indexed batchId, address indexed to, uint256 amount, address indexed caller);
    event BatchStatusUpdated(uint256 indexed batchId, bool active);
    event SettlementVaultUpdated(address indexed settlementVault);
    event ComplianceUpdated(address indexed compliance);

    function createBatch(
        bytes32 merchantIdHash,
        bytes32 productIdHash,
        address purchaseToken,
        uint256 unitCost,
        uint256 unitPayout,
        uint256 unitsForSale,
        string calldata tokenName,
        string calldata tokenSymbol,
        address issuer,
        address founder
    ) external returns (uint256 batchId);

    function buyUnits(uint256 batchId, uint256 units) external;

    function withdrawProceeds(uint256 batchId, uint256 amount, address to) external;

    function setBatchActive(uint256 batchId, bool active) external;

    function setSettlementVault(address settlementVault) external;

    function setCompliance(address compliance) external;

    function getBatch(uint256 batchId) external view returns (InventoryTypes.Batch memory);
}
