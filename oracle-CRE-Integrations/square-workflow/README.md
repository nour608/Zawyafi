# Square Revenue Workflow (CRE)

This workflow fetches Square daily revenue for all detected categories, filters to tokenized categories onchain for a given batch, and submits signed reports to `OracleCoordinator` via CRE `writeReport`.

## Config

Required fields in `config.staging.json` / `config.production.json`:

- `schedule`
- `squareBaseUrl`
- `squareVersion`
- `locationId`
- `merchantId`
- `batchId`
- `oracleCoordinatorAddress`
- `chainSelectorName`
- `isTestnet`
- `gasLimit`
- `minEventCountForWrite`

## Secrets

`workflow.yaml` points to `../secrets.yaml`, which maps:

- secret ID `SQUARE_PAT` -> env variable `SQUARE_PAT`

Set the value in `oracle/square-workflow/.env`:

```bash
SQUARE_PAT=<square_access_token>
```

## Run checks

From `oracle/square-workflow`:

```bash
bun x tsc --noEmit
```

From project root:

```bash
cre workflow simulate ./square-workflow --target staging-settings
```
