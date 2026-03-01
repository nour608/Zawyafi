# Square Testing Cafe Integration (Stateless)

Minimal backend for a normal cafe Square integration.

- Uses `SQUARE_PAT_FALLBACK_TOKEN` (sandbox PAT)
- Reads payments/refunds directly from Square API (no local DB)
- Verifies Square webhook signatures (optional)
- Includes scripts to create cafe catalog categories/items in Square

## Endpoints

- `GET /health`
- `GET /square/locations`
- `GET /square/payments/daily?merchantId=merchant-1&date=2026-02-17`
  - optional filters:
  - `category=Coffee`
  - `item=Cappuccino`
- `GET /square/refunds/daily?merchantId=merchant-1&date=2026-02-17`
- `POST /square/webhooks`
- `GET /frontend/overview?date=2026-02-17`
- `GET /frontend/batches`
- `GET /frontend/batches/:batchId`
- `GET /frontend/periods?batchId=1&status=VERIFIED&cursor=0&limit=20`
- `GET /frontend/portfolio?wallet=0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7`
- `GET /frontend/tx/:txHash`

`/frontend/*` routes are a query-friendly facade for the new frontend and currently use deterministic in-memory indexed data for hackathon demos.

## Error response shape

```json
{
  "errorCode": "SQUARE_AUTH_FAILED",
  "message": "Square authentication failed",
  "requestId": "req-3",
  "retriable": false,
  "details": {}
}
```

## Local run

1. Install dependencies:

```bash
cd square-testing-cafe-integration
npm install
```

2. Configure environment:

```bash
cp env.sample .env
```

3. Start dev server:

```bash
npm run dev
```

Default local port is `3001` so it can run alongside core `backend` on `3000`.

4. Run tests:

```bash
npm test
```

## Setup Square cafe inventory (Catalog API)

This ensures the following exist in your Square sandbox catalog:

- 3 categories
- 3 products per category
- fixed realistic pricing

```bash
npm run setup:catalog
```

Inventory source file: `square-testing-cafe-integration/data/cafe-inventory.json`

## Seed sandbox sales (orders/payments/refunds)

`npm run seed:square` now:

1. Ensures catalog categories/items exist in Square.
2. Creates orders referencing catalog item variations.
3. Creates matching payments.
4. Creates small refunds (strictly under 5%).

```bash
npm run seed:square
```

Optional seed controls:

- `SEED_LOCATION_ID`
- `SEED_MERCHANT_LABEL`
- `SEED_NOTE_PREFIX`
- `SEED_ORDER_COUNT` (default `8`)
- `SEED_REFUND_COUNT` (default `1`)
- `SEED_MAX_REFUND_ORDER_RATE_PERCENT` (default `20`)
- `SEED_MIN_QTY` / `SEED_MAX_QTY`
- `SEED_REFUND_MIN_PERCENT` / `SEED_REFUND_MAX_PERCENT` (must stay below `5`)
- `SEED_DELAY_MS`

## Validate live fetch

```bash
curl -s "http://127.0.0.1:3001/square/payments/daily?merchantId=merchant-1&date=2026-02-17&category=Bakery"
curl -s "http://127.0.0.1:3001/square/payments/daily?merchantId=merchant-1&date=2026-02-17&category=Bakery&item=Cinnamon%20Roll"
curl -s "http://127.0.0.1:3001/square/refunds/daily?merchantId=merchant-1&date=2026-02-17"
```

Or run:

```bash
export TEST_MERCHANT_ID=merchant-1
npm run test:cafe-flow
```

## Webhook verification

If webhook signature verification is required, set:

- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL`
- `SQUARE_WEBHOOK_REQUIRE_SIGNATURE=true`
