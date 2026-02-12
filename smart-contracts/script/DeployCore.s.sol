// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Script} from "forge-std/Script.sol";
import {Factory} from "../src/core/Factory.sol";
import {CurrencyManager} from "../src/core/CurrencyManager.sol";
import {Compliance} from "../src/compliance/Compliance.sol";
import {IdentityRegistry} from "../src/registry/IdentityRegistry.sol";

contract DeployCore is Script {
    function run()
        external
        returns (
            IdentityRegistry identityRegistry,
            CurrencyManager currencyManager,
            Compliance complianceContract,
            Factory factory
        )
    {
        vm.startBroadcast();

        identityRegistry = new IdentityRegistry();
        currencyManager = new CurrencyManager();
        complianceContract = new Compliance(msg.sender, address(identityRegistry));
        factory = new Factory(address(identityRegistry), address(currencyManager), 500);

        vm.stopBroadcast();
    }
}
