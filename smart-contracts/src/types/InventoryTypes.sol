// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

library InventoryTypes {
    enum PeriodStatus {
        UNVERIFIED,
        VERIFIED
    }

    struct CategoryConfigInput {
        bytes32 categoryIdHash;
        uint256 unitsForSale;
        uint256 unitCost;
    }

    struct CategoryState {
        bytes32 categoryIdHash;
        uint256 unitsForSale;
        uint256 unitsSold;
        uint256 unitCost;
        uint256 principalSold;
        bool tokenized;
    }

    struct Batch {
        uint256 id;
        bytes32 merchantIdHash;
        address issuer;
        address founder;
        address purchaseToken;
        address unitToken;
        uint16 profitBps;
        uint256 principalSoldTotal;
        uint256 targetPayoutTotal;
        uint256 settledRevenueTotal;
        uint256 totalUnitsForSale;
        uint256 totalUnitsSold;
        uint256 proceedsWithdrawn;
        bool active;
        bool closed;
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
