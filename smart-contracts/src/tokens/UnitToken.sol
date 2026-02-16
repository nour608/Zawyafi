// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ICompliance} from "../interfaces/ICompliance.sol";

contract UnitToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    ICompliance public compliance;

    event ComplianceUpdated(address indexed compliance);
    event BurnerUpdated(address indexed burner, bool allowed);

    error TransferNotAllowed(address from, address to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        address compliance_,
        address minter_,
        address burner_,
        address admin_
    ) ERC20(name_, symbol_) {
        require(compliance_ != address(0), "UnitToken: invalid compliance");
        require(minter_ != address(0), "UnitToken: invalid minter");
        require(admin_ != address(0), "UnitToken: invalid admin");

        compliance = ICompliance(compliance_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, minter_);

        if (burner_ != address(0)) {
            _grantRole(BURNER_ROLE, burner_);
        }
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused {
        _burn(from, amount);
    }

    function setCompliance(address compliance_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(compliance_ != address(0), "UnitToken: invalid compliance");
        compliance = ICompliance(compliance_);
        emit ComplianceUpdated(compliance_);
    }

    function setBurner(address burner, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(burner != address(0), "UnitToken: invalid burner");
        if (allowed) {
            _grantRole(BURNER_ROLE, burner);
        } else {
            _revokeRole(BURNER_ROLE, burner);
        }
        emit BurnerUpdated(burner, allowed);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 value) internal virtual override whenNotPaused {
        if (!compliance.canTransfer(from, to, value)) {
            revert TransferNotAllowed(from, to, value);
        }
        super._update(from, to, value);
    }
}
