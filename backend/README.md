# Core Backend (CRE KYC + API Gateway)

Core backend service for:

- Backend-owned KYC intake with Sumsub
- Internal CRE callbacks for bind/onchain settlement
- Postgres-backed KYC state machine and idempotency (SQLite fallback for local/tests)
- Proxying `/square/*` and `/frontend/*` to `square-testing-cafe-integration`

## Endpoints

### Public (no wallet auth)

- `GET /health`
- `POST /kyc/webhook/sumsub`

### Wallet-authenticated

- `POST /kyc/start` (wallet must match payload wallet)
- `GET /kyc/session/:requestId` (owner wallet only)
- `GET /compliance/kyc/requests` (compliance/admin allowlisted wallet)
- `GET /compliance/investors` (compliance/admin allowlisted wallet)
- `POST /compliance/reports` (compliance/admin allowlisted wallet)
- `GET /compliance/reports` (compliance/admin allowlisted wallet)
- `GET /compliance/reports/:requestId` (compliance/admin allowlisted wallet)
- `GET|POST /square/*` (merchant/admin allowlisted wallet)
- `GET /frontend/*` (authenticated wallet)

Wallet auth headers:

- `x-auth-address`
- `x-auth-timestamp`
- `x-auth-signature`

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
- Production mode should set `DATABASE_URL` to Postgres. Schema is auto-created at startup.
- `DATABASE_SSL=true` enables TLS for Postgres (recommended on AWS/App Runner).
- If `DATABASE_URL` is not set, backend falls back to SQLite and `KYC_DB_PATH` (default `./data/kyc.db`).
- `KYC_HMAC_KEY` is required for wallet commitment generation during `/kyc/start`.
- `SUMSUB_APP_TOKEN` and `SUMSUB_SECRET_KEY` are required for backend intake calls.
- `SUMSUB_WEBHOOK_SECRET` is required in production (`NODE_ENV=production`).
- Configure `CORS_ALLOWED_ORIGINS` with your frontend origin(s) for browser access.
- Configure `ADMIN_ALLOWLIST`, `MERCHANT_ALLOWLIST`, and `COMPLIANCE_ALLOWLIST` for server-side role checks.
- Tune per-IP request throttling with `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_KYC_START_MAX`, and `RATE_LIMIT_COMPLIANCE_CREATE_MAX`.
- Compliance queue controls: `COMPLIANCE_LOCK_SECONDS`, `COMPLIANCE_RETRY_BASE_DELAY_SECONDS`, `COMPLIANCE_MAX_ATTEMPTS`.
