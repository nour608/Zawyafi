// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

interface DataTypes {
    ////////////////////////
    //////// Profile ////////
    ////////////////////////

    struct Profile {
        address walletAddress;
        bool verified; // Flag to check if profile is verified by the platform
        bool freezed;
        /// Additional fields can be added as needed, e.g. KYC/AML status, country code, investment amount per project, etc.
    }

    struct Project {
        string name;
        address equityToken; // Deployed ERC-3643 compliant token with compliance checks, this is the token that represents the project's equity
        address purchaseToken; // this is the token that will be used to purchase the project's equity
        uint256 valuationUSD; // Project valuation in USD (no decimals)
        uint256 totalShares; // Total share supply (whole units)
        uint256 availableSharesToSell; // Shares to sell
        uint256 sharesSold; // Shares already sold
        uint256 pricePerShare; // Stablecoin units per 1 share
        uint256 availableFunds; // Available funds to withdraw
        address issuer; // Project issuer
        address founder; // Project founder
        bool exists; // Flag to check if project exists
        bool verified; // Flag to check if project is verified by the platform
        // Secondary market fields
        bool secondaryMarketEnabled; // Whether secondary trading is enabled
    }
}
