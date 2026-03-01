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
- `gaslessReadMode`

## Secrets

- `BACKEND_INTERNAL_TOKEN`

Keep `backendInternalToken` empty in config files and source this value from secrets.
