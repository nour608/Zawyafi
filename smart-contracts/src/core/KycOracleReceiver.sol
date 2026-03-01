// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IReceiver} from "../interfaces/IReceiver.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

contract KycOracleReceiver is AccessControl, Pausable, IReceiver {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes private constant HEX_CHARS = "0123456789abcdef";

    IIdentityRegistry public immutable identityRegistry;

    address private s_forwarderAddress;
    address private s_expectedAuthor;
    bytes10 private s_expectedWorkflowName;
    bytes32 private s_expectedWorkflowId;

    mapping(bytes32 => bool) public processedRequestIds;

    error InvalidIdentityRegistry();
    error InvalidAdmin();
    error InvalidForwarderAddress();
    error InvalidSender(address sender, address expected);
    error InvalidMetadata();
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowName(bytes10 received, bytes10 expected);
    error WorkflowNameRequiresAuthorValidation();
    error DuplicateRequest(bytes32 requestIdHash);

    event KycProcessed(bytes32 indexed requestIdHash, address indexed wallet, bool alreadyVerified, uint64 approvedAt);
    event ForwarderAddressUpdated(address indexed previousForwarder, address indexed newForwarder);
    event ExpectedAuthorUpdated(address indexed previousAuthor, address indexed newAuthor);
    event ExpectedWorkflowNameUpdated(bytes10 indexed previousName, bytes10 indexed newName);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previousId, bytes32 indexed newId);

    constructor(address identityRegistry_, address admin_, address forwarder_) {
        if (identityRegistry_ == address(0)) revert InvalidIdentityRegistry();
        if (admin_ == address(0)) revert InvalidAdmin();
        if (forwarder_ == address(0)) revert InvalidForwarderAddress();

        identityRegistry = IIdentityRegistry(identityRegistry_);
        s_forwarderAddress = forwarder_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        emit ForwarderAddressUpdated(address(0), forwarder_);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override whenNotPaused {
        if (msg.sender != s_forwarderAddress) {
            revert InvalidSender(msg.sender, s_forwarderAddress);
        }

        if (
            s_expectedWorkflowId != bytes32(0) || s_expectedAuthor != address(0)
                || s_expectedWorkflowName != bytes10(0)
        ) {
            (bytes32 workflowId, bytes10 workflowName, address workflowOwner) = _decodeMetadata(metadata);

            if (s_expectedWorkflowId != bytes32(0) && workflowId != s_expectedWorkflowId) {
                revert InvalidWorkflowId(workflowId, s_expectedWorkflowId);
            }

            if (s_expectedAuthor != address(0) && workflowOwner != s_expectedAuthor) {
                revert InvalidAuthor(workflowOwner, s_expectedAuthor);
            }

            if (s_expectedWorkflowName != bytes10(0)) {
                if (s_expectedAuthor == address(0)) {
                    revert WorkflowNameRequiresAuthorValidation();
                }
                if (workflowName != s_expectedWorkflowName) {
                    revert InvalidWorkflowName(workflowName, s_expectedWorkflowName);
                }
            }
        }

        (bytes32 requestIdHash, address wallet, uint64 approvedAt) = abi.decode(report, (bytes32, address, uint64));

        if (processedRequestIds[requestIdHash]) {
            revert DuplicateRequest(requestIdHash);
        }

        bool alreadyVerified = identityRegistry.isVerified(wallet);
        if (!alreadyVerified) {
            identityRegistry.addAddress(wallet);
        }

        processedRequestIds[requestIdHash] = true;

        emit KycProcessed(requestIdHash, wallet, alreadyVerified, approvedAt);
    }

    function getForwarderAddress() external view returns (address) {
        return s_forwarderAddress;
    }

    function setForwarderAddress(address forwarder) external onlyRole(ADMIN_ROLE) {
        if (forwarder == address(0)) revert InvalidForwarderAddress();
        address previousForwarder = s_forwarderAddress;
        s_forwarderAddress = forwarder;
        emit ForwarderAddressUpdated(previousForwarder, forwarder);
    }

    function getExpectedAuthor() external view returns (address) {
        return s_expectedAuthor;
    }

    function setExpectedAuthor(address author) external onlyRole(ADMIN_ROLE) {
        address previousAuthor = s_expectedAuthor;
        s_expectedAuthor = author;
        emit ExpectedAuthorUpdated(previousAuthor, author);
    }

    function getExpectedWorkflowName() external view returns (bytes10) {
        return s_expectedWorkflowName;
    }

    function setExpectedWorkflowName(string calldata name) external onlyRole(ADMIN_ROLE) {
        bytes10 previousName = s_expectedWorkflowName;
        s_expectedWorkflowName = _workflowNameFromString(name);
        emit ExpectedWorkflowNameUpdated(previousName, s_expectedWorkflowName);
    }

    function getExpectedWorkflowId() external view returns (bytes32) {
        return s_expectedWorkflowId;
    }

    function setExpectedWorkflowId(bytes32 workflowId) external onlyRole(ADMIN_ROLE) {
        bytes32 previousId = s_expectedWorkflowId;
        s_expectedWorkflowId = workflowId;
        emit ExpectedWorkflowIdUpdated(previousId, workflowId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _decodeMetadata(bytes calldata metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        if (metadata.length < 62) revert InvalidMetadata();
        assembly {
            workflowId := calldataload(metadata.offset)
            workflowName := calldataload(add(metadata.offset, 32))
            workflowOwner := shr(96, calldataload(add(metadata.offset, 42)))
        }
    }

    function _workflowNameFromString(string calldata name) internal pure returns (bytes10 workflowName) {
        if (bytes(name).length == 0) {
            return bytes10(0);
        }

        bytes32 nameHash = sha256(bytes(name));
        bytes memory hexString = _bytesToHexString(abi.encodePacked(nameHash));
        assembly {
            workflowName := mload(add(hexString, 32))
        }
    }

    function _bytesToHexString(bytes memory data) internal pure returns (bytes memory) {
        bytes memory hexString = new bytes(data.length * 2);
        for (uint256 i = 0; i < data.length; i++) {
            hexString[i * 2] = HEX_CHARS[uint8(data[i] >> 4)];
            hexString[i * 2 + 1] = HEX_CHARS[uint8(data[i] & 0x0f)];
        }
        return hexString;
    }
}
