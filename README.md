# VeraAudit (Gemini + Walrus + Sui Testnet)

Full-stack trustless smart-contract audit dashboard:
- Audit Move packages with Gemini.
- Store full audit payloads on Walrus.
- Anchor blob references on Sui testnet through Tatum RPC.

## Stack
- Frontend: React + Vite
- Backend: Express
- Storage: Walrus HTTP API
- Chain: Sui testnet RPC via Tatum
- LLM: Gemini API (`@google/genai`)

## Prerequisites
- Node.js 18+ (tested on Node 22)
- Tatum API key
- Gemini API key
- Optional: Sui private key + deployed registry package/object IDs for live anchoring

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
- `server/` Express APIs + Gemini/Walrus/Sui integrations
- `frontend/` dashboard, audit flow, verification pages

## Notes
- This build defaults to testnet everywhere.
- If anchoring env vars are missing, anchoring is simulated and the flow still completes.
