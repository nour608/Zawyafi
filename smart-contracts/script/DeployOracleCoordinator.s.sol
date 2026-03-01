// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Script} from "forge-std/Script.sol";
import {OracleCoordinator} from "../src/core/OracleCoordinator.sol";

contract DeployOracleCoordinator is Script {
    function run() external returns (OracleCoordinator oracleCoordinator) {
        address revenueRegistry = vm.envAddress("REVENUE_REGISTRY_ADDRESS");
        address settlementVault = vm.envAddress("SETTLEMENT_VAULT_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address forwarder = vm.envAddress("FORWARDER_ADDRESS");

        vm.startBroadcast();
        oracleCoordinator = new OracleCoordinator(revenueRegistry, settlementVault, admin, oracle, forwarder);
        vm.stopBroadcast();
    }
}
