// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ICompliance} from "../interfaces/ICompliance.sol";

/// @title Token
/// @notice ERC-3643 compliant token with compliance checks
/// @dev Overrides _update hook to enforce compliance rules
contract EquityToken is ERC20, Pausable, AccessControl {
    ICompliance public compliance;

    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    uint256 public constant TOTAL_SHARES = 1_000_000 * 1e18; // total shares is 100% equity and the total supply of the token
    uint256 public sharesToSell; // shares to sell is the amount of shares that will be sold to the public
    address public factory;
    address public issuer;

    modifier onlyIssuer() {
        require(msg.sender == address(issuer), "Only issuer can call this function");
        _;
    }

    /// @notice Event emitted when the compliance contract is updated
    event ComplianceUpdated(address indexed newCompliance);

    /// @notice Error thrown when a transfer fails compliance check
    error TransferNotAllowed(address from, address to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address _factory,
        uint256 SharesToSell,
        uint256 _platformFee,
        address _compliance
    ) ERC20(name_, symbol_) {
        _grantRole(FACTORY_ROLE, _factory);

        issuer = initialOwner;

        require(_compliance != address(0), "Token: zero address for compliance");
        compliance = ICompliance(_compliance);
        require(SharesToSell <= TOTAL_SHARES, "Shares to sell must be less than or equal to total shares");
        sharesToSell = SharesToSell - _platformFee;
        factory = _factory;
        uint256 initialOwnerShares = TOTAL_SHARES - sharesToSell - _platformFee;
        require(factory != address(0), "Factory address cannot be 0");
        _mint(factory, _platformFee);
        _mint(initialOwner, initialOwnerShares);
        _pause(); // pause the token transfers
    }

    function mint(address to, uint256 amount) public onlyRole(FACTORY_ROLE) whenNotPaused {
        require(amount <= sharesToSell, "EquityToken: Max supply exceeded");
        _mint(to, amount);
        sharesToSell -= amount;
    }

    function setSharesToSell(uint256 _sharesToSell) external onlyIssuer whenNotPaused {
        require(_sharesToSell <= TOTAL_SHARES, "Shares to sell must be less than or equal to total shares");
        require(_sharesToSell > sharesToSell, "Shares to sell must be greater than the current shares to sell");
        sharesToSell += _sharesToSell;
        _burn(msg.sender, _sharesToSell);
    }

    function getSharesToSell() external view returns (uint256) {
        return sharesToSell;
    }

    /// @notice Hook called before any token transfer
    /// @param from The address sending tokens (address(0) for minting)
    /// @param to The address receiving tokens (address(0) for burning)
    /// @param value The amount of tokens to transfer
    /// @dev Overrides ERC20._update to add compliance checks
    function _update(address from, address to, uint256 value) internal virtual override whenNotPaused {
        // Check compliance before allowing the transfer
        if (!compliance.canTransfer(from, to, value)) {
            revert TransferNotAllowed(from, to, value);
        }

        // Call parent _update to perform the actual transfer
        super._update(from, to, value);
    }

    ///////////////////////////////
    /// Admin Functionality //////
    /////////////////////////////

    /// @notice Update the compliance contract address
    function setCompliance(address _compliance) external onlyRole(FACTORY_ROLE) {
        require(_compliance != address(0), "Token: zero address for compliance");
        compliance = ICompliance(_compliance);
        emit ComplianceUpdated(_compliance);
    }

    function setFactory(address _factory) external onlyRole(FACTORY_ROLE) {
        require(_factory != address(0), "Token: zero address for factory");
        factory = _factory;
    }

    /*////////////////////////////////
          Pausable Functionality
    //////////////////////////////////*/

    /// @notice Pause token transfers (only factory)
    function pause() external {
        require(hasRole(FACTORY_ROLE, msg.sender), "Only factory can pause");
        _pause();
    }

    /// @notice Unpause token transfers (only factory)
    function unpause() external {
        require(hasRole(FACTORY_ROLE, msg.sender), "Only factory can unpause");
        _unpause();
    }

    /*////////////////////////////////
          Internal functions
    //////////////////////////////////*/
    function _onlyFactory() internal view {
        require(msg.sender == factory, "Only factory can call this function");
    }
}
