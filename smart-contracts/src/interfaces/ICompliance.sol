// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

/// @title ICompliance
/// @notice Simplified interface for Compliance contract (ERC-3643 compliant)
/// @dev This is a minimal MVP implementation of the TREX standard
interface ICompliance {
    /// @notice Check if a transfer is allowed
    /// @param from The address sending tokens (address(0) for minting)
    /// @param to The address receiving tokens (address(0) for burning)
    /// @param amount The amount of tokens to transfer
    /// @return true if the transfer is allowed, false otherwise
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
}
