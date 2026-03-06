// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

contract CheckSlots is Script {
    function run() external {
        bytes32 periodId = 0x498788a4516d63826dc944548caaca4f68e91fa6168af16211f538098a158600;
        address sender = 0xDb4c31628Ff691d114863058F1034B54964dfD62; // OracleCoordinator
        bytes32 oracleRole = 0x3ec0ae75b804c543561ded2ab897013f61bd28c5bdfd6972d2b2b34d726fd3b1;

        console.log("Checking _recorded mapping slots...");
        for (uint256 i = 0; i < 10; i++) {
            bytes32 slot = keccak256(abi.encode(periodId, i));
            if (
                slot ==
                0x372f6ec6c22dd782ddf02d3bef7a49e6edf011bfb9c8c26945a78146d47b70c8
            ) {
                console.log(
                    "0x372f is _recorded[periodId] at mapping slot %s",
                    i
                );
            }
        }

        console.log("Checking OZ hasRole slots...");
        for (uint256 i = 0; i < 10; i++) {
            bytes32 roleSlot = keccak256(abi.encode(oracleRole, i));
            bytes32 hasRoleSlot = keccak256(abi.encode(sender, roleSlot));
            if (
                hasRoleSlot ==
                0x372f6ec6c22dd782ddf02d3bef7a49e6edf011bfb9c8c26945a78146d47b70c8
            ) {
                console.log("0x372f is hasRole at mapping slot %s", i);
            }
            if (
                hasRoleSlot ==
                0x3ec0ae75b804c543561ded2ab897013f61bd28c5bdfd6972d2b2b34d726fd3b1
            ) {
                console.log("0x3ec0 is hasRole at mapping slot %s", i);
            }
        }

        // Check ERC7201 AccessControl
        // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.AccessControl")) - 1)) & ~bytes32(uint256(0xff))
        bytes32 AC_SLOT = 0x02dd7bc7dec4dceed8f1f2155f848c7c980eb21ae137e5eaf88db7ce3fcc0600;
        bytes32 roleStorageSlot = keccak256(abi.encode(oracleRole, AC_SLOT));
        bytes32 roleHasRoleSlot = keccak256(
            abi.encode(sender, roleStorageSlot)
        );

        if (
            roleHasRoleSlot ==
            0x372f6ec6c22dd782ddf02d3bef7a49e6edf011bfb9c8c26945a78146d47b70c8
        ) {
            console.log("0x372f is hasRole using OZ 5.x AccessControl!");
        }
    }
}
