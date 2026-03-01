# KYC Settlement Workflow (CRE)

Cron-driven CRE workflow that:

1. Pulls approved records from `GET /internal/kyc/ready-onchain`
2. Encodes report payload `(requestIdHash, wallet, approvedAt)`
3. Writes report onchain to `KycOracleReceiver`
4. Calls `POST /internal/kyc/onchain-result` with success/retryable outcome

## Config

- `schedule`
- `backendBaseUrl`
- `readyOnchainPath`
- `onchainResultPath`
- `chainSelectorName`
- `isTestnet`
- `kycReceiverAddress`
- `gasLimit`
- `maxBatch`

## Secrets

- `BACKEND_INTERNAL_TOKEN`

Keep `backendInternalToken` empty in config files and source this value from secrets.
