// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICompliance} from "../interfaces/ICompliance.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/// @title Compliance
/// @notice Simplified Compliance contract for ERC-3643 compliant tokens
/// @dev Validates transfers by checking the IdentityRegistry
contract Compliance is ICompliance, Ownable {
    IIdentityRegistry public identityRegistry;

    event IdentityRegistryUpdated(address indexed newRegistry);

    constructor(address initialOwner, address _identityRegistry) Ownable(initialOwner) {
        require(_identityRegistry != address(0), "Compliance: zero address for identity registry");
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /// @notice Check if a transfer is allowed
    /// @param from The address sending tokens (address(0) for minting)
    /// @param to The address receiving tokens (address(0) for burning)
    /// @return true if the transfer is allowed, false otherwise
    function canTransfer(
        address from,
        address to,
        uint256 /* amount */
    )
        external
        view
        override
        returns (bool)
    {
        // Minting: receiver must be active and compliant.
        if (from == address(0)) {
            return to != address(0) && identityRegistry.isVerified(to) && !identityRegistry.isFreezed(to)
                && !identityRegistry.isBlacklisted(to);
        }

        // Burning: only 'from' needs to be verified
        if (to == address(0)) {
            return identityRegistry.isVerified(from);
        }

        // Regular transfer: both 'from' and 'to' must be verified
        return identityRegistry.isVerified(from) && identityRegistry.isVerified(to) && !identityRegistry.isFreezed(from)
            && !identityRegistry.isFreezed(to) && !identityRegistry.isBlacklisted(from)
            && !identityRegistry.isBlacklisted(to);
    }

    /// @notice Update the identity registry address
    /// @param _identityRegistry The new IdentityRegistry contract address
    /// @dev Only callable by owner.
    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        require(_identityRegistry != address(0), "Compliance: zero address for identity registry");
        identityRegistry = IIdentityRegistry(_identityRegistry);
        emit IdentityRegistryUpdated(_identityRegistry);
    }
}
