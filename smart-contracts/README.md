## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ export FORWARDER_ADDRESS=<mock_or_keystone_forwarder_address>
$ forge script script/DeployInventoryCore.s.sol:DeployInventoryCore --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast
```

### Deploy Only OracleCoordinator

Set required constructor inputs first:

```shell
$ export REVENUE_REGISTRY_ADDRESS=<deployed_revenue_registry_address>
$ export SETTLEMENT_VAULT_ADDRESS=<deployed_settlement_vault_address>
$ export ADMIN_ADDRESS=<admin_wallet_address>
$ export ORACLE_ADDRESS=<manual_oracle_address_optional>
$ export FORWARDER_ADDRESS=<mock_or_keystone_forwarder_address>
```

Then deploy:

```shell
$ forge script script/DeployOracleCoordinator.s.sol:DeployOracleCoordinator --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast
```

### Receiver Security Configuration

`OracleCoordinator` now implements CRE `IReceiver` with `onReport`. Reports are only accepted from the configured forwarder.

- For simulation, use the network `MockKeystoneForwarder` address.
- For deployed workflows, use the network `KeystoneForwarder` address.
- Optional metadata hardening can be configured after deployment:
  - `setExpectedWorkflowId(bytes32)`
  - `setExpectedAuthor(address)`
  - `setExpectedWorkflowName(string)`

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
