# Core Backend (CRE KYC + API Gateway)

Core backend service for:

- Backend-owned KYC intake with Sumsub
- Internal CRE callbacks for bind/onchain settlement
- SQLite-backed KYC state machine and idempotency
- Proxying `/square/*` and `/frontend/*` to `square-testing-cafe-integration`

## Endpoints

### Public

- `GET /health`
- `POST /kyc/start`
- `GET /kyc/session/:requestId`
- `POST /kyc/webhook/sumsub`
- `POST /compliance/reports`
- `GET /compliance/reports/:requestId`
- `GET|POST /square/*` (proxy)
- `GET /frontend/*` (proxy)

### Internal (Bearer `INTERNAL_API_TOKEN`)

- `POST /internal/kyc/bind`
- `GET /internal/kyc/ready-onchain?limit=100`
- `POST /internal/kyc/onchain-result`
- `GET /internal/compliance/ready?limit=25`
- `POST /internal/compliance/report-result`

## Local run

```bash
cd backend
cp env.sample .env
npm install
npm run dev
```

Runs on `http://127.0.0.1:3000` by default.

## Notes

- Configure `SQUARE_PROXY_BASE_URL` to your Square test service (default `http://127.0.0.1:3001`).
- `KYC_DB_PATH` defaults to `./data/kyc.db`.
- `KYC_HMAC_KEY` is required for wallet commitment generation during `/kyc/start`.
- `SUMSUB_APP_TOKEN` and `SUMSUB_SECRET_KEY` are required for backend intake calls.
- `SUMSUB_WEBHOOK_SECRET` is required in production (`NODE_ENV=production`).
- Configure `CORS_ALLOWED_ORIGINS` with your frontend origin(s) for browser access.
- Tune per-IP request throttling with `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_KYC_START_MAX`, and `RATE_LIMIT_COMPLIANCE_CREATE_MAX`.
- Compliance queue controls: `COMPLIANCE_LOCK_SECONDS`, `COMPLIANCE_RETRY_BASE_DELAY_SECONDS`, `COMPLIANCE_MAX_ATTEMPTS`.
