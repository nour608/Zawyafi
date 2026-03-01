# Zawyafi Frontend (Next.js)

Frontend V1 for the Zawyafi hackathon demo, including:

- `/` narrative control-room landing page
- `/merchant` merchant operations and funding actions
- `/investor` investor buy/claim workflows
- `/compliance` period flags and export tools
- `/admin` workflow trust controls

## Stack

- Next.js App Router + TypeScript + Tailwind
- Thirdweb SDK + Viem for wallet and onchain reads/writes
- TanStack Query for API/query state
- Vitest + Testing Library + Playwright + axe

## Local setup

1. Install dependencies:

```bash
cd frontend
nvm use
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` in `.env.local` using your Thirdweb dashboard client id.

3. Start the app:

```bash
npm run dev
```

App runs on `http://127.0.0.1:3000` by default.

## Node version requirement

This project requires Node.js `>=22 <25` (see `.nvmrc` and `package.json` engines).

If you run with Node 25+, Next.js may fail with runtime errors like:

- `Could not find the module ...segment-explorer-node.js#SegmentViewNode in the React Client Manifest`
- `__webpack_modules__[moduleId] is not a function`

Always run:

```bash
cd frontend
nvm use
node -v
```

## Recovery steps for manifest/runtime mismatch

If dev server starts returning `500` with the errors above, run:

```bash
cd frontend
nvm use
rm -rf .next node_modules
npm ci
npm run dev
```

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint checks
- `npm run test` - unit tests
- `npm run test:e2e` - Playwright tests

## Backend dependency

Frontend expects backend endpoints from core `backend/`:

- Existing Square routes (`/square/payments/daily`, `/square/refunds/daily`, `/square/locations`) via backend proxy
- Frontend facade routes (`/frontend/overview`, `/frontend/batches`, `/frontend/periods`, `/frontend/portfolio`, `/frontend/tx`)
