// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {Test} from "forge-std/Test.sol";
import {Factory} from "../src/core/Factory.sol";
import {CurrencyManager} from "../src/core/CurrencyManager.sol";
import {IdentityRegistry} from "../src/registry/IdentityRegistry.sol";

contract FactoryTest is Test {
    Factory internal factory;
    CurrencyManager internal currencyManager;
    IdentityRegistry internal identityRegistry;

    function setUp() public {
        identityRegistry = new IdentityRegistry();
        currencyManager = new CurrencyManager();
        factory = new Factory(address(identityRegistry), address(currencyManager), 500);
    }

    function test_ProjectCounterStartsAtOne() public view {
        assertEq(factory.projectCount(), 1);
    }

    function test_DeployerHasAdminRoles() public view {
        assertTrue(factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), address(this)));
        assertTrue(factory.hasRole(factory.ADMIN_ROLE(), address(this)));
    }
}
