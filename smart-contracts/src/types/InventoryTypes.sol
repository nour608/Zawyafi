// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

library InventoryTypes {
    enum PeriodStatus {
        UNVERIFIED,
        VERIFIED
    }

    struct Batch {
        uint256 id;
        bytes32 merchantIdHash;
        bytes32 productIdHash;
        address issuer;
        address founder;
        address purchaseToken;
        address unitToken;
        uint256 unitCost;
        uint256 unitPayout;
        uint256 unitsForSale;
        uint256 unitsSoldToInvestors;
        uint256 fundsRaised;
        bool active;
    }

    struct PeriodReport {
        bytes32 periodId;
        bytes32 merchantIdHash;
        bytes32 productIdHash;
        uint64 periodStart;
        uint64 periodEnd;
        uint256 grossSales;
        uint256 refunds;
        uint256 netSales;
        uint256 unitsSold;
        uint256 refundUnits;
        uint256 netUnitsSold;
        uint256 eventCount;
        bytes32 batchHash;
        uint64 generatedAt;
        PeriodStatus status;
        uint16 riskScore;
        bytes32 reasonCode;
    }
}
