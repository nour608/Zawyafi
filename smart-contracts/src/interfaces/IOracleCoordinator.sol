// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {InventoryTypes} from "../types/InventoryTypes.sol";
import {IReceiver} from "./IReceiver.sol";

interface IOracleCoordinator is IReceiver {
    event PeriodProcessed(bytes32 indexed periodId, uint256 indexed batchId, bool verified, uint256 unitsSettled);
    event ForwarderAddressUpdated(address indexed previousForwarder, address indexed newForwarder);
    event ExpectedAuthorUpdated(address indexed previousAuthor, address indexed newAuthor);
    event ExpectedWorkflowNameUpdated(bytes10 indexed previousName, bytes10 indexed newName);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previousId, bytes32 indexed newId);

    function onReport(bytes calldata metadata, bytes calldata report) external;

    function processPeriodAndSettle(InventoryTypes.PeriodReport calldata report, uint256 batchId) external;

    function getForwarderAddress() external view returns (address);

    function setForwarderAddress(address forwarder) external;

    function getExpectedAuthor() external view returns (address);

    function setExpectedAuthor(address author) external;

    function getExpectedWorkflowName() external view returns (bytes10);

    function setExpectedWorkflowName(string calldata name) external;

    function getExpectedWorkflowId() external view returns (bytes32);

    function setExpectedWorkflowId(bytes32 workflowId) external;
}
