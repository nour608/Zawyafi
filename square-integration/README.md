# Square-Chainlink CRE Integration

Production-ready integration between Square API and Chainlink Runtime Environment (CRE) for recording daily sales on blockchain.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Square    │─────▶│   CRE Workflow   │─────▶│   Blockchain    │
│     API     │      │   (TypeScript)   │      │  (Sepolia/ETH)  │
└─────────────┘      └──────────────────┘      └─────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Chainlink DON   │
                     │  (Consensus)     │
                     └──────────────────┘
```

### Components

1. **CRE Workflow**: TypeScript workflow using Chainlink Runtime Environment SDK
2. **Cron Trigger**: Executes daily at 23:59 UTC
3. **HTTP Capability**: Fetches Square transactions with consensus
4. **EVM Write Capability**: Submits signed reports to blockchain
5. **Smart Contract**: IReceiver-compliant consumer contract

## Prerequisites

1. **CRE Account**: Create account at [cre.chain.link](https://cre.chain.link)
2. **CRE CLI**: Install from [docs.chain.link/cre/getting-started/cli-installation](https://docs.chain.link/cre/getting-started/cli-installation)
3. **Square API**: Access token and location ID
4. **Wallet**: Funded with Sepolia ETH for contract deployment

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to CRE

```bash
cre auth login
```

### 3. Deploy Smart Contract

Get the Sepolia forwarder address from [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory) and update `scripts/deploy.js`.

```bash
npm run compile
npm run deploy
```

Copy the deployed contract address.

### 4. Configure Workflow

Update `square-workflow/config.json`:
- `consumerAddress`: Your deployed contract address
- `squareAccessToken`: Use `{{SQUARE_ACCESS_TOKEN}}` for secrets
- `squareLocationId`: Use `{{SQUARE_LOCATION_ID}}` for secrets

### 5. Set Secrets

```bash
cre secrets set SQUARE_ACCESS_TOKEN your_actual_token
cre secrets set SQUARE_LOCATION_ID your_actual_location_id
```

### 6. Simulate Workflow

```bash
cd square-workflow
cre workflow simulate
```

### 7. Deploy Workflow (Early Access Required)

Request access at [cre.chain.link/request-access](https://cre.chain.link/request-access)

```bash
cre workflow deploy
cre workflow activate
```

## How It Works

### Trigger-and-Callback Model

CRE workflows use a trigger-and-callback pattern:

1. **Cron Trigger**: Fires daily at 23:59 UTC
2. **Callback Function**: `processDailySales()` executes when triggered
3. **Consensus**: Every operation runs across multiple DON nodes with BFT consensus

### Execution Flow

1. Workflow triggers at scheduled time
2. Fetches yesterday's Square transactions via HTTP capability
3. Aggregates totals (gross, net, tax, refunds, count)
4. Generates SHA-256 hash of transaction IDs + aggregates
5. ABI-encodes data using viem
6. Generates signed report via `runtime.report()`
7. Submits to blockchain via `evmClient.writeReport()`
8. Chainlink Forwarder validates signatures
9. Forwarder calls consumer contract's `onReport()` function
10. Contract stores immutable sales record

## Smart Contract

**DailySalesRecorder.sol** - IReceiver-compliant contract:
- Receives data from Chainlink Forwarder (not directly from workflow)
- Idempotency protection (prevents duplicate date submissions)
- Event emission for off-chain indexing
- Data integrity via SHA-256 hashing

### Key Functions

- `onReport(bytes metadata, bytes report)`: Receives data from forwarder
- `getSalesByDate(uint256 date)`: Retrieves historical records
- `setForwarder(address)`: Updates forwarder address (owner only)

## Security Considerations

1. **Secrets Management**: Square credentials stored in CRE secrets, never in code
2. **Consensus Computing**: Every API call and computation verified by multiple nodes
3. **Cryptographic Signatures**: Reports signed by DON before submission
4. **Forwarder Validation**: Only trusted DON reports accepted on-chain
5. **Replay Protection**: Contract prevents duplicate date submissions
6. **Data Integrity**: SHA-256 hash of transaction IDs + aggregates

## Cost Estimation

### Gas Costs (Sepolia/Mainnet)

- Contract Deployment: ~400,000 gas (~$4-12 on mainnet)
- Daily Recording: ~120,000 gas (~$1.50-6 per day on mainnet)
- Monthly: ~$45-180 (30 days)
- Annual: ~$550-2,190

### CRE Costs

- Simulation: Free
- Deployment: Contact Chainlink for Early Access pricing
- Execution: Per-workflow execution fees (contact Chainlink)

## Monitoring & Debugging

View workflow execution logs and metrics in the CRE UI:
- [cre.chain.link](https://cre.chain.link)
- Real-time execution logs
- Transaction status tracking
- Performance metrics

## CLI Commands

```bash
# Simulate locally
cre workflow simulate

# Deploy to DON (Early Access)
cre workflow deploy

# Activate workflow
cre workflow activate

# Pause workflow
cre workflow pause

# View logs
cre workflow logs

# Update workflow
cre workflow update

# Delete workflow
cre workflow delete
```

## Troubleshooting

**Issue**: "Date already recorded"
- Solution: Contract prevents duplicates. Normal behavior if workflow runs twice for same date.

**Issue**: Simulation fails with Square API error
- Solution: Verify `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID` secrets are set correctly.

**Issue**: Transaction reverted
- Solution: Check forwarder address in contract matches network's forwarder.

**Issue**: No transactions fetched
- Solution: Verify Square credentials and location ID. Check date range.

## Development Workflow

1. **Build**: Write workflow in TypeScript using CRE SDK
2. **Simulate**: Test locally with real API calls (`cre workflow simulate`)
3. **Deploy**: Deploy to DON for production execution
4. **Monitor**: Track execution in CRE UI
5. **Update**: Modify and redeploy as needed

## API Reference

### Square API Integration

```typescript
fetchSquareTransactions(runtime, date) // Fetches via HTTP capability
```

### Data Aggregation

```typescript
aggregateAndHash(transactions, timestamp) // Returns DailySalesData
```

### Blockchain Submission

```typescript
runtime.report({...})              // Generates signed report
evmClient.writeReport(runtime, {}) // Submits to blockchain
```

## Resources

- [CRE Documentation](https://docs.chain.link/cre)
- [Getting Started Guide](https://docs.chain.link/cre/getting-started/overview)
- [EVM Write Guide](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/writing-data-onchain)
- [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)
- [Square API Docs](https://developer.squareup.com/reference/square)

## License

MIT

