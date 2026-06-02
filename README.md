# VeraAudit (Gemini + Tatum Walrus + Sui Mainnet)

Full-stack trustless smart-contract audit dashboard:
- Audit Move packages with Gemini.
- Store full audit payloads on Walrus through Tatum's storage API.
- Anchor blob references on Sui mainnet through Tatum RPC, with direct fullnode fallback only if Tatum fails.

## Stack
- Frontend: React + Vite
- Backend: Express
- Storage: Tatum Walrus Storage API + Walrus mainnet aggregator
- Chain: Sui mainnet RPC via Tatum
- LLM: Gemini API (`@google/genai`)

## Prerequisites
- Node.js 18+ (tested on Node 22)
- Tatum API key
- Gemini API key
- Sui private key + deployed mainnet registry package/object IDs for live anchoring

## Quick start
1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   - `cmd /c npm install`
3. Run both apps:
   - `cmd /c npm run dev`
4. Open:
   - `http://localhost:5173`

## Server tests
- Run: `cmd /c npm run test -w server`
- Includes:
  - retry/backoff behavior
  - audit pipeline step outputs
  - Gemini 429 recovery path

## Mainnet anchoring contract deployment
From `contracts/`, publish with the same wallet that will later sign audit anchors:

```bash
sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
sui client switch --env mainnet
sui client active-address
sui client balance
sui move build
sui client publish --gas-budget 100000000
```

After publish, set these in `.env` from the publish output:

```bash
REGISTRY_PACKAGE_ID=<Published Objects PackageID>
REGISTRY_OBJECT_ID=<Created AuditRegistry shared object ID>
ADMIN_CAP_OBJECT_ID=<Created AdminCap object ID owned by deployer>
SUI_CLOCK_OBJECT_ID=0x6
SUI_PRIVATE_KEY=<private key for the publishing/admin wallet>
```

The registry mints `AdminCap` during `init`; anchoring requires passing `&AdminCap` and `&Clock` (`0x6`) to `submit_audit`.

## Tatum Walrus upload
Set these before running live audits:

```bash
TATUM_API_KEY=<mainnet Tatum key>
TATUM_WALRUS_UPLOAD_URL=https://api.tatum.io/v4/data/storage/upload
TATUM_WALRUS_STATUS_POLL_MS=5000
TATUM_WALRUS_STATUS_MAX_ATTEMPTS=36
WALRUS_AGGREGATOR=https://aggregator.walrus-mainnet.walrus.space
```

The backend uploads audit JSON only through Tatum's Walrus upload endpoint, polls until the upload is `CERTIFIED`, and then reads through the mainnet aggregator.
No Mysten Walrus client is used for upload fallback.

## Key API endpoints
- `GET /api/check/:contractId`
- `POST /api/audit` (SSE stream)
- `GET /api/blob/:blobId`
- `GET /api/verify/:blobId`
- `GET /api/metrics`

### `/api/audit` SSE events
- `progress`: step started
- `step_log`: detailed step logs (retries, provider notes)
- `step_output`: structured output per step (counts, sizes, IDs)
- `complete`: final audit payload
- `error`: structured pipeline failure payload

## Project structure
- `contracts/` Move contract (`AuditRegistry`)
- `server/` Express APIs + Gemini/Tatum Walrus/Sui integrations
- `frontend/` dashboard, audit flow, verification pages

## Notes
- This build defaults to Sui mainnet and Walrus mainnet reads.
- If anchoring env vars are missing, anchoring is simulated and the flow still completes.
