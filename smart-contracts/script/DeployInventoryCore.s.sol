// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Script} from "forge-std/Script.sol";
import {CurrencyManager} from "../src/core/CurrencyManager.sol";
import {ProductBatchFactory} from "../src/core/ProductBatchFactory.sol";
import {RevenueRegistry} from "../src/core/RevenueRegistry.sol";
import {SettlementVault} from "../src/core/SettlementVault.sol";
import {OracleCoordinator} from "../src/core/OracleCoordinator.sol";
import {Compliance} from "../src/compliance/Compliance.sol";
import {IdentityRegistry} from "../src/registry/IdentityRegistry.sol";

contract DeployInventoryCore is Script {
    function run()
        external
        returns (
            IdentityRegistry identityRegistry,
            Compliance compliance,
            CurrencyManager currencyManager,
            ProductBatchFactory factory,
            RevenueRegistry revenueRegistry,
            SettlementVault settlementVault,
            OracleCoordinator oracleCoordinator
        )
    {
        vm.startBroadcast();

        identityRegistry = new IdentityRegistry();
        compliance = new Compliance(msg.sender, address(identityRegistry));
        currencyManager = new CurrencyManager();

        factory = new ProductBatchFactory(address(currencyManager), address(compliance), msg.sender);
        settlementVault = new SettlementVault(address(factory), msg.sender, address(0));
        factory.setSettlementVault(address(settlementVault));

        revenueRegistry = new RevenueRegistry(msg.sender, address(0));
        oracleCoordinator = new OracleCoordinator(address(revenueRegistry), address(settlementVault), msg.sender, msg.sender);

        revenueRegistry.grantRole(revenueRegistry.ORACLE_ROLE(), address(oracleCoordinator));
        settlementVault.grantRole(settlementVault.ORACLE_ROLE(), address(oracleCoordinator));

        vm.stopBroadcast();
    }
}
