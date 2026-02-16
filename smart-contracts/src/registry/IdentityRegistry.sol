// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry
/// @notice Simplified Identity Registry for ERC-3643 compliant tokens
/// @dev Stores whitelist of wallet addresses mapped to country codes
contract IdentityRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Profile {
        address walletAddress;
        bool verified;
        bool freezed;
    }

    /// @notice Mapping from address to whitelist status
    mapping(address => Profile) public profiles;
    mapping(address => bool) public blacklisted;

    event AddressVerified(address indexed agent);
    event AddressBlacklisted(address indexed agent);
    event AddressUnblacklisted(address indexed agent);
    event AddressFreezed(address indexed agent);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice add an address to the whitelist
    function addAddress(address agent) external onlyRole(ADMIN_ROLE) {
        require(!profiles[agent].verified, "IdentityRegistry: address already whitelisted");
        profiles[agent] = Profile({walletAddress: agent, verified: true, freezed: false});
        emit AddressVerified(agent);
    }

    /// @notice Blacklist an address
    function blockAddress(address agent, bool Block) external onlyRole(ADMIN_ROLE) {
        if (Block) {
            if (profiles[agent].verified) {
                profiles[agent].freezed = true;
                emit AddressFreezed(agent);
            }
            blacklisted[agent] = true;
            emit AddressBlacklisted(agent);
        } else {
            if (profiles[agent].verified) {
                profiles[agent].freezed = false;
                emit AddressFreezed(agent);
            }
            blacklisted[agent] = false;
            emit AddressUnblacklisted(agent);
        }
    }

    /// @notice Blacklist an address
    function freeze(address agent, bool Freeze) external onlyRole(ADMIN_ROLE) {
        require(profiles[agent].verified, "IdentityRegistry: address not whitelisted");
        profiles[agent].freezed = Freeze;
        emit AddressFreezed(agent);
    }

    /// @notice Batch whitelist addresses
    function batchWhitelist(address[] calldata agents) external onlyRole(ADMIN_ROLE) {
        require(agents.length > 0, "IdentityRegistry: no addresses to whitelist");
        for (uint256 i = 0; i < agents.length; i++) {
            require(agents[i] != address(0), "IdentityRegistry: zero address");
            profiles[agents[i]] = Profile({walletAddress: agents[i], verified: true, freezed: false});
            emit AddressVerified(agents[i]);
        }
    }

    /// @notice Check if an address is verified in the registry
    function isVerified(address agent) external view returns (bool) {
        return profiles[agent].verified;
    }

    // we can add logic to set limits for number of addresses for spending limits per project,
    // e.g. the address X can't invest more than 10k USD in single project or can't hold more than 20% of the equity of the project.
}
