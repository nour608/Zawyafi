// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Test} from "forge-std/Test.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IdentityRegistry} from "../../src/registry/IdentityRegistry.sol";
import {KycOracleReceiver} from "../../src/core/KycOracleReceiver.sol";
import {IReceiver} from "../../src/interfaces/IReceiver.sol";

contract KycOracleReceiverTest is Test {
    IdentityRegistry internal identityRegistry;
    KycOracleReceiver internal receiver;

    address internal forwarder = makeAddr("forwarder");
    address internal outsider = makeAddr("outsider");
    address internal workflowOwner = makeAddr("workflowOwner");
    address internal wallet = makeAddr("wallet");

    function setUp() public {
        identityRegistry = new IdentityRegistry();
        receiver = new KycOracleReceiver(address(identityRegistry), address(this), forwarder);
        identityRegistry.grantRole(identityRegistry.ADMIN_ROLE(), address(receiver));
    }

    function test_OnReportVerifiesWallet() public {
        bytes32 requestIdHash = keccak256("request-1");
        bytes memory report = abi.encode(requestIdHash, wallet, uint64(block.timestamp));

        vm.prank(forwarder);
        receiver.onReport("", report);

        assertTrue(identityRegistry.isVerified(wallet));
        assertTrue(receiver.processedRequestIds(requestIdHash));
    }

    function test_OnReportAlreadyVerifiedWalletDoesNotRevert() public {
        identityRegistry.addAddress(wallet);

        bytes32 requestIdHash = keccak256("request-2");
        bytes memory report = abi.encode(requestIdHash, wallet, uint64(block.timestamp));

        vm.prank(forwarder);
        receiver.onReport("", report);

        assertTrue(identityRegistry.isVerified(wallet));
        assertTrue(receiver.processedRequestIds(requestIdHash));
    }

    function test_OnReportRevertsForNonForwarder() public {
        bytes32 requestIdHash = keccak256("request-3");
        bytes memory report = abi.encode(requestIdHash, wallet, uint64(block.timestamp));

        vm.expectRevert(abi.encodeWithSelector(KycOracleReceiver.InvalidSender.selector, outsider, forwarder));
        vm.prank(outsider);
        receiver.onReport("", report);
    }

    function test_ReplayReverts() public {
        bytes32 requestIdHash = keccak256("request-4");
        bytes memory report = abi.encode(requestIdHash, wallet, uint64(block.timestamp));

        vm.prank(forwarder);
        receiver.onReport("", report);

        vm.expectRevert(abi.encodeWithSelector(KycOracleReceiver.DuplicateRequest.selector, requestIdHash));
        vm.prank(forwarder);
        receiver.onReport("", report);
    }

    function test_MetadataValidation_RevertsOnAuthorMismatch() public {
        receiver.setExpectedAuthor(workflowOwner);

        bytes32 requestIdHash = keccak256("request-5");
        bytes memory report = abi.encode(requestIdHash, wallet, uint64(block.timestamp));
        bytes memory metadata = _buildMetadata(bytes32("workflow-1"), bytes10("zawyafi001"), outsider);

        vm.expectRevert(abi.encodeWithSelector(KycOracleReceiver.InvalidAuthor.selector, outsider, workflowOwner));
        vm.prank(forwarder);
        receiver.onReport(metadata, report);
    }

    function test_MetadataValidation_RevertsOnWorkflowIdMismatch() public {
        receiver.setExpectedWorkflowId(bytes32("expected-workflow-id"));

        bytes32 requestIdHash = keccak256("request-6");
        bytes memory report = abi.encode(requestIdHash, wallet, uint64(block.timestamp));
        bytes32 receivedWorkflowId = bytes32("other-workflow-id");
        bytes memory metadata = _buildMetadata(receivedWorkflowId, bytes10("zawyafi001"), workflowOwner);

        vm.expectRevert(
            abi.encodeWithSelector(
                KycOracleReceiver.InvalidWorkflowId.selector, receivedWorkflowId, bytes32("expected-workflow-id")
            )
        );
        vm.prank(forwarder);
        receiver.onReport(metadata, report);
    }

    function test_SupportsInterfaceForReceiverAndERC165() public view {
        assertTrue(receiver.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(receiver.supportsInterface(type(IERC165).interfaceId));
    }

    function _buildMetadata(bytes32 workflowId, bytes10 workflowName, address owner)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(workflowId, workflowName, owner);
    }
}
