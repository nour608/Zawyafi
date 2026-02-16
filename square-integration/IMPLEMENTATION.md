# Square-Chainlink CRE Integration

This project implements a production-ready integration between Square API and Chainlink Runtime Environment (CRE) to record daily sales data on the blockchain.

## What It Does

Every day at 23:59 UTC, the workflow:
1. Fetches all completed transactions from Square for the previous day
2. Aggregates sales data (gross, net, tax, refunds, transaction count)
3. Generates a cryptographic hash for data integrity
4. Submits the data to a smart contract on Ethereum Sepolia

## Architecture

The system uses **Chainlink Runtime Environment (CRE)** - a decentralized orchestration layer that runs your workflow across multiple independent nodes with Byzantine Fault Tolerant consensus.

**Key Components:**
- **CRE Workflow** (TypeScript): Orchestrates the entire process
- **HTTP Capability**: Fetches Square data with consensus across DON nodes
- **EVM Write Capability**: Submits signed reports to blockchain
- **Smart Contract**: IReceiver-compliant consumer that stores sales records
- **Chainlink Forwarder**: Validates DON signatures before calling your contract

## Prerequisites

1. **CRE Account**: Sign up at [cre.chain.link](https://cre.chain.link)
2. **CRE CLI**: Install from [docs](https://docs.chain.link/cre/getting-started/cli-installation)
3. **Square API Credentials**: Access token and location ID
4. **Funded Wallet**: Sepolia ETH for contract deployment

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to CRE

```bash
cre auth login
```

### 3. Deploy Smart Contract

First, get the Sepolia forwarder address from the [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory).

Update `scripts/deploy.js` with the forwarder address, then:

```bash
npm run compile
npm run deploy
```

Save the deployed contract address.

### 4. Configure Workflow

Edit `square-workflow/config.json`:
```json
{
  "consumerAddress": "0xYourDeployedContractAddress",
  "squareAccessToken": "{{SQUARE_ACCESS_TOKEN}}",
  "squareLocationId": "{{SQUARE_LOCATION_ID}}"
}
```

### 5. Set Secrets

```bash
cre secrets set SQUARE_ACCESS_TOKEN your_token_here
cre secrets set SQUARE_LOCATION_ID your_location_id_here
```

### 6. Simulate Locally

```bash
cd square-workflow
cre workflow simulate
```

This runs your workflow locally but makes **real API calls** to Square and Sepolia.

### 7. Deploy to Production (Early Access)

Request access at [cre.chain.link/request-access](https://cre.chain.link/request-access)

```bash
cre workflow deploy
cre workflow activate
```

## How It Works

### The Trigger-and-Callback Model

CRE workflows use a simple pattern:
1. **Trigger** (Cron): Fires at 23:59 UTC daily
2. **Callback** (`processDailySales`): Your business logic
3. **Handler**: Connects trigger to callback

### Execution Flow

```
Cron Trigger (23:59 UTC)
    ↓
processDailySales() callback
    ↓
HTTP Capability → Fetch Square transactions (with consensus)
    ↓
Aggregate data + generate hash
    ↓
ABI-encode data (viem)
    ↓
runtime.report() → Generate signed report
    ↓
evmClient.writeReport() → Submit to blockchain
    ↓
Chainlink Forwarder validates signatures
    ↓
Forwarder calls contract.onReport()
    ↓
Contract stores immutable record
```

### Consensus Computing

Every operation (API calls, computations) runs across multiple independent DON nodes. Results are validated through Byzantine Fault Tolerant consensus, eliminating single points of failure.

## Smart Contract

**DailySalesRecorder.sol** implements the `IReceiver` interface:

```solidity
function onReport(bytes calldata metadata, bytes calldata report) external
```

The contract:
- Only accepts calls from the trusted Chainlink Forwarder
- Prevents duplicate submissions for the same date
- Emits events for off-chain indexing
- Stores: date, gross, net, tax, refunds, count, hash

## Project Structure

```
square-chainlink-cre/
├── contracts/
│   └── DailySalesRecorder.sol    # IReceiver consumer contract
├── scripts/
│   └── deploy.js                  # Deployment script
├── square-workflow/
│   ├── config.json                # Workflow configuration
│   └── main.ts                    # Workflow code
├── hardhat.config.js              # Hardhat configuration
├── project.yaml                   # CRE project metadata
└── package.json
```

## Configuration

### Workflow Config (`square-workflow/config.json`)

```json
{
  "schedule": "59 23 * * *",              // Cron: daily at 23:59 UTC
  "chainSelectorName": "ethereum-testnet-sepolia",
  "consumerAddress": "0x...",             // Your deployed contract
  "gasLimit": "500000",
  "squareAccessToken": "{{SQUARE_ACCESS_TOKEN}}",  // From secrets
  "squareLocationId": "{{SQUARE_LOCATION_ID}}",    // From secrets
  "squareEnvironment": "sandbox"          // or "production"
}
```

## CLI Commands

```bash
# Simulate workflow locally
cre workflow simulate

# Deploy to DON (requires Early Access)
cre workflow deploy

# Activate deployed workflow
cre workflow activate

# Pause workflow
cre workflow pause

# View execution logs
cre workflow logs

# Update deployed workflow
cre workflow update

# Delete workflow
cre workflow delete
```

## Security

1. **Secrets Management**: Credentials stored in CRE secrets, never in code
2. **Consensus**: Every operation verified by multiple independent nodes
3. **Cryptographic Signatures**: DON signs reports before submission
4. **Forwarder Validation**: Only trusted DON reports accepted on-chain
5. **Idempotency**: Contract prevents duplicate date submissions
6. **Data Integrity**: SHA-256 hash of transaction IDs + aggregates

## Cost Estimation

### Gas Costs (Sepolia/Mainnet)

| Operation | Gas | Mainnet Cost (est.) |
|-----------|-----|---------------------|
| Contract Deployment | ~400,000 | $4-12 |
| Daily Recording | ~120,000 | $1.50-6 |
| Monthly (30 days) | - | $45-180 |
| Annual | - | $550-2,190 |

### CRE Costs

- **Simulation**: Free
- **Deployment & Execution**: Contact Chainlink for Early Access pricing

## Monitoring

View real-time execution logs and metrics at [cre.chain.link](https://cre.chain.link):
- Execution history
- Transaction status
- Performance metrics
- Error logs

## Troubleshooting

**"Date already recorded"**
- Normal behavior. Contract prevents duplicates.

**Simulation fails with Square API error**
- Verify secrets: `cre secrets list`
- Check Square credentials and location ID

**Transaction reverted**
- Verify forwarder address matches network
- Check contract has correct forwarder set

**No transactions fetched**
- Verify Square environment (sandbox vs production)
- Check date range and location ID

## Resources

- [CRE Documentation](https://docs.chain.link/cre)
- [Getting Started Tutorial](https://docs.chain.link/cre/getting-started/overview)
- [EVM Write Guide](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/writing-data-onchain)
- [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)
- [Square API Docs](https://developer.squareup.com/reference/square)

## License

MIT
