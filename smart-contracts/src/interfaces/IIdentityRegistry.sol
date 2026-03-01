// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

/// @title IIdentityRegistry
/// @notice Simplified interface for Identity Registry (ERC-3643 compliant)
interface IIdentityRegistry {
    /// @notice Add an address to verified identities
    /// @param agent The wallet address to verify
    function addAddress(address agent) external;

    /// @notice Check if an address is verified in the registry
    /// @param agent The address to check
    /// @return true if the address is verified (whitelisted)
    function isVerified(address agent) external view returns (bool);
    function isFreezed(address agent) external view returns (bool);
    function isBlacklisted(address agent) external view returns (bool);
}
