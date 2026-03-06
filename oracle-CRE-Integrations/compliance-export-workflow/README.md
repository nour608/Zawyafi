# Compliance Export Workflow (CRE)

Cron-driven CRE workflow that:

1. Pulls pending compliance jobs from `GET /internal/compliance/ready`
2. Reads `RevenueRegistry` onchain logs and period structs
3. Builds a normalized compliance report packet with audit traces
4. Calls `POST /internal/compliance/report-result` with `SUCCESS` or retry outcome

## Config

- `schedule`
- `backendBaseUrl`
- `readyPath`
- `resultPath`
- `chainSelectorName`
- `isTestnet`
- `revenueRegistryAddress`
- `revenueRegistryDeployBlock`
- `maxBatch`
- `scanLookbackBlocks`
- `minConfirmations`
- `resultPostMaxAttempts`

## Reliability Behavior

- Ready-record payloads are validated at runtime (`requestId`, `merchantIdHash`, `startDate`, `endDate`).
- Invalid records are posted back as `RETRYABLE` with `errorCode=INVALID_READY_RECORD`.
- Block scan is bounded:
  - `toBlock = latestBlock - minConfirmations`
  - `fromBlock = max(revenueRegistryDeployBlock, toBlock - scanLookbackBlocks + 1)`
- Result callback posting uses bounded retries (`resultPostMaxAttempts`).
- Callback failures are isolated so one failed callback does not abort the full batch.
- `reportHash` is deterministic for identical report data across retries.

## Safety Guards

- On non-testnet, `backendBaseUrl` must use HTTPS.
- On non-testnet, `revenueRegistryAddress` cannot be zero.
- On testnet, non-HTTPS base URL logs a warning.

## Secrets

- `BACKEND_INTERNAL_TOKEN`

Keep `backendInternalToken` empty in config files and source this value from secrets.
