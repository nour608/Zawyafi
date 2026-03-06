// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {InventoryTypes} from "../types/InventoryTypes.sol";
import {IProductBatchFactory} from "../interfaces/IProductBatchFactory.sol";
import {IRevenueRegistry} from "../interfaces/IRevenueRegistry.sol";
import {ISettlementVault} from "../interfaces/ISettlementVault.sol";
import {IOracleCoordinator} from "../interfaces/IOracleCoordinator.sol";
import {IReceiver} from "../interfaces/IReceiver.sol";

contract OracleCoordinator is AccessControl, Pausable, IOracleCoordinator {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    bytes private constant HEX_CHARS = "0123456789abcdef";

    IRevenueRegistry public immutable revenueRegistry;
    ISettlementVault public immutable settlementVault;

    address private s_forwarderAddress;
    address private s_expectedAuthor;
    bytes10 private s_expectedWorkflowName;
    bytes32 private s_expectedWorkflowId;

    error InvalidRevenueRegistry();
    error InvalidSettlementVault();
    error InvalidAdmin();
    error InvalidForwarderAddress();
    error InvalidSender(address sender, address expected);
    error InvalidMetadata();
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowName(bytes10 received, bytes10 expected);
    error WorkflowNameRequiresAuthorValidation();
    error UnknownBatch(uint256 batchId);
    error MerchantMismatch(bytes32 received, bytes32 expected);
    error CategoryNotTokenized(bytes32 categoryIdHash);
    error BatchHashMismatch(bytes32 received, bytes32 expected);

    constructor(address revenueRegistry_, address settlementVault_, address admin_, address oracle_, address forwarder_) {
        if (revenueRegistry_ == address(0)) revert InvalidRevenueRegistry();
        if (settlementVault_ == address(0)) revert InvalidSettlementVault();
        if (admin_ == address(0)) revert InvalidAdmin();
        if (forwarder_ == address(0)) revert InvalidForwarderAddress();

        revenueRegistry = IRevenueRegistry(revenueRegistry_);
        settlementVault = ISettlementVault(settlementVault_);
        s_forwarderAddress = forwarder_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        if (oracle_ != address(0)) {
            _grantRole(ORACLE_ROLE, oracle_);
        }

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

        (InventoryTypes.PeriodReport memory periodReport, uint256 batchId) =
            abi.decode(report, (InventoryTypes.PeriodReport, uint256));
        _processPeriodAndSettle(periodReport, batchId);
    }

    function processPeriodAndSettle(InventoryTypes.PeriodReport calldata report, uint256 batchId)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        _processPeriodAndSettle(report, batchId);
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

    function _processPeriodAndSettle(InventoryTypes.PeriodReport memory report, uint256 batchId) internal {
        _validateReportAgainstBatch(report, batchId);
        revenueRegistry.recordPeriod(report);

        uint256 amountSettled = 0;
        bool verified = report.status == InventoryTypes.PeriodStatus.VERIFIED;
        if (!verified) {
            revenueRegistry.setStatus(report.periodId, InventoryTypes.PeriodStatus.UNVERIFIED);
        }
        if (verified && report.netSales > 0) {
            amountSettled = settlementVault.settleCategoryRevenue(report.periodId, batchId, report.productIdHash, report.netSales);
        }

        emit PeriodProcessed(report.periodId, batchId, verified, amountSettled);
    }

    function _validateReportAgainstBatch(InventoryTypes.PeriodReport memory report, uint256 batchId) internal view {
        InventoryTypes.Batch memory batch = IProductBatchFactory(settlementVault.factory()).getBatch(batchId);
        if (batch.id == 0) revert UnknownBatch(batchId);

        if (report.merchantIdHash != batch.merchantIdHash) {
            revert MerchantMismatch(report.merchantIdHash, batch.merchantIdHash);
        }

        if (!IProductBatchFactory(settlementVault.factory()).isCategoryTokenized(batchId, report.productIdHash)) {
            revert CategoryNotTokenized(report.productIdHash);
        }

        bytes32 expectedBatchHash = keccak256(abi.encode(batchId));
        if (report.batchHash != expectedBatchHash) {
            revert BatchHashMismatch(report.batchHash, expectedBatchHash);
        }
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

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
