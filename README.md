# VeraAudit

VeraAudit is a full-stack Sui Move smart contract auditing system that combines:

- Tatum for Sui RPC access and Walrus upload orchestration
- Gemini for structured contract security analysis
- RAG for Sui/Move-specific security grounding
- Walrus for immutable audit artifact storage
- Sui mainnet anchoring for public verifiability

The result is a proof-oriented audit workflow where each audit can be:

1. generated from real on-chain package state
2. enriched with targeted security context
3. stored as immutable evidence
4. anchored on Sui mainnet
5. re-opened and verified later from the dashboard

## What the Project Does

Given a Sui package ID, VeraAudit:

1. fetches normalized Move modules from Sui through Tatum
2. gathers recent transaction and event context
3. retrieves relevant Sui/Move security knowledge through RAG
4. asks Gemini to produce a structured audit result
5. stores the full audit blob on Walrus via Tatum's storage API
6. anchors the resulting Walrus quilt/blob reference on Sui mainnet
7. exposes the audit history, report, and verification flow through a React frontend

This is not just an LLM wrapper. The system is designed so that the audit record is traceable across:

- source package ID
- chain context used during analysis
- retrieved security references
- immutable Walrus artifact
- on-chain anchor event

## Architecture Summary

### Core Components

- `frontend/`
  React + Vite UI for landing page, audit workspace, audit history, and proof verification
- `server/`
  Express API server that coordinates Tatum, Gemini, Walrus, RAG, and Sui anchoring
- `contracts/`
  Sui Move registry contract used to store audit anchor metadata on-chain

### High-Level Responsibilities

- Frontend
  Collects package IDs, renders metrics, streams pipeline progress, displays stored audits, and verifies proofs
- Backend
  Fetches package and transaction context, runs RAG + Gemini, uploads Walrus artifacts, anchors results on Sui
- Contract
  Emits auditable on-chain events that reference the Walrus artifact and audit hash

## Runtime Contract Addresses on Sui Mainnet

The current runtime configuration in `.env` points the application to the following live Sui objects:

| Item | Address |
| --- | --- |
| Registry package ID | `0xdd47918fec65c24ad41115782ab780d7f234e163d6c75cf1b39622ed6bd20a21` |
| Registry shared object ID | `0xe5fc0c83fd0331bdc3c924d83cbd9a121cde440283ae58b37f8205e0124ca530` |
| Admin capability object ID | `0xb77fe7f28a3e8d35271e6b1a26024d0de48f22b245bb9e01a3b2f68076d1e9a9` |
| Clock object ID | `0x6` |


## Move Contract

The Sui registry contract lives at [contracts/sources/registry.move](/C:/Users/singa/Downloads/veraAudit/contracts/sources/registry.move).

It stores audit metadata and emits an `AuditSubmitted` event for each anchored audit.

### Main data structures

- `AuditRegistry`
  Shared on-chain registry containing:
  - admin address
  - total audit count
  - mapping from audited package address to `vector<AuditEntry>`
- `AuditEntry`
  Stores:
  - Walrus blob/quilt ID
  - audit hash
  - auditor address
  - epoch
  - severity
  - timestamp
- `AuditSubmitted`
  Event emitted for off-chain indexing and audit history reconstruction

### Main entry point

- `submit_audit`
  Writes a new audit entry into the registry and emits the corresponding event

## Complete Audit Pipeline

The pipeline implementation lives in [server/src/auditPipeline.js](/C:/Users/singa/Downloads/veraAudit/server/src/auditPipeline.js).

### Step-by-step flow

1. Fetch package modules
   - Calls `sui_getNormalizedMoveModulesByPackage`
   - Receives normalized Move module ABI/data for the target package

2. Build transaction and event context
   - Enumerates exposed functions from the normalized modules
   - Queries transaction blocks using `suix_queryTransactionBlocks`
   - Compacts and limits chain context for model input
   - Falls back to guarded `suix_queryEvents` lookups when needed

3. Retrieve RAG context
   - Generates security-oriented retrieval queries from:
     - module names
     - exposed function names
     - struct names
     - field/type signals
     - recent event types
   - Uses embeddings when enabled
   - Falls back to lexical retrieval when embedding calls are unavailable

4. Run Gemini audit
   - Builds a structured prompt containing:
     - normalized modules
     - recent transaction context
     - recent event context
     - retrieved RAG guidance
   - Forces Gemini to return strict JSON matching the audit schema

5. Assemble immutable audit artifact
   - Stores the full audit payload, chain snapshot, and retrieval metadata in a single JSON blob

6. Upload to Walrus
   - Sends the audit JSON through Tatum's Walrus upload API
   - Polls until the upload is certified
   - Extracts the final quilt/blob identifier

7. Anchor on Sui mainnet
   - Computes a SHA-256 hash of the audit blob
   - Submits `submit_audit` on the registry contract
   - Stores:
     - audited contract/package ID
     - Walrus quilt/blob ID
     - audit hash
     - severity
     - timestamp

8. Expose results to the UI
   - Emits structured SSE step events during the run
   - Persists discoverability through Sui events and Walrus storage

## Detailed ASCII Diagram

```text
                                  V E R A A U D I T
========================================================================================

  User / Frontend
        |
        | 1. submit package id
        v
  POST /api/audit  -------------------------------------------------------------+
        |                                                                        |
        v                                                                        |
  +----------------------+                                                       |
  | Express Audit Server |                                                       |
  +----------------------+                                                       |
        |                                                                        |
        | 2. fetch normalized modules                                            |
        |    3. fetch tx/event context                                           |
        v                                                                        |
  +---------------------------+                                                  |
  | Tatum Sui RPC Gateway     |                                                  |
  | https://sui-mainnet...    |                                                  |
  +---------------------------+                                                  |
        |                                                                        |
        | returns package ABI, tx blocks, events                                 |
        v                                                                        |
  +---------------------------+                                                  |
  | Pipeline Context Builder  |                                                  |
  | - exposed function scan   |                                                  |
  | - tx compaction           |                                                  |
  | - event extraction        |                                                  |
  +---------------------------+                                                  |
        |                                                                        |
        | 4. build RAG queries                                                   |
        v                                                                        |
  +---------------------------+         5a. embedding retrieval (optional)       |
  | RAG Retriever             | ------------------------------------------+      |
  | - local knowledge base    |                                            |      |
  | - lexical ranking         |                                            |      |
  | - embedding ranking       |                                            v      |
  +---------------------------+                                 +--------------------------+
        |                                                         | Gemini Embeddings API    |
        | 5b. top security chunks                                 | gemini-embedding-001     |
        v                                                         +--------------------------+
  +---------------------------+                                                  |
  | Prompt Assembler          |                                                  |
  | - modules                 |                                                  |
  | - tx context              |                                                  |
  | - event context           |                                                  |
  | - RAG guidance            |                                                  |
  +---------------------------+                                                  |
        |                                                                        |
        | 6. structured audit request                                            |
        v                                                                        |
  +---------------------------+                                                  |
  | Gemini Audit Model        |                                                  |
  | generates JSON findings   |                                                  |
  +---------------------------+                                                  |
        |                                                                        |
        | 7. full audit artifact JSON                                            |
        v                                                                        |
  +---------------------------+                                                  |
  | Walrus Upload via Tatum   |  --> POST /v4/data/storage/upload                |
  | certification polling     |  --> GET  /v4/data/storage/upload/:jobId         |
  +---------------------------+                                                  |
        |                                                                        |
        | returns quilt/blob id                                                  |
        v                                                                        |
  +---------------------------+                                                  |
  | Hash + Anchor Builder     |                                                  |
  | sha256(auditBlob)         |                                                  |
  +---------------------------+                                                  |
        |                                                                        |
        | 8. submit_audit move call                                              |
        v                                                                        |
  +---------------------------+                                                  |
  | Sui Mainnet Registry      |                                                  |
  | AuditSubmitted event      |                                                  |
  +---------------------------+                                                  |
        |                                                                        |
        +--------------------> 9. UI reads /api/check, /api/metrics, /api/blob --+
                                 and reconstructs history from:
                                 - Sui events
                                 - Walrus blob
                                 - stored audit report
```

## Tatum Integration

Tatum is the operational backbone for the chain and Walrus interactions.

### Where Tatum is used

1. Sui JSON-RPC access
   - package introspection
   - transaction lookups
   - event queries
   - anchor transaction submission

2. Walrus upload orchestration
   - audit blob upload
   - certification polling

3. Request pacing and retry handling
   - outbound Tatum requests are serialized through [server/src/tatumTransport.js](/C:/Users/singa/Downloads/veraAudit/server/src/tatumTransport.js)
   - `TATUM_MIN_INTERVAL_MS` spaces requests to reduce rate-limit issues

### Tatum endpoints used

#### Tatum Sui RPC base URL

- `https://sui-mainnet.gateway.tatum.io`

#### JSON-RPC methods used through Tatum

- `sui_getNormalizedMoveModulesByPackage`
- `suix_queryTransactionBlocks`
- `suix_queryEvents`
- `sui_executeTransactionBlock`
- `sui_getLatestCheckpointSequenceNumber`

#### Tatum Walrus endpoints used

- `POST https://api.tatum.io/v4/data/storage/upload`
  Enqueue Walrus upload
- `GET https://api.tatum.io/v4/data/storage/upload/:jobId`
  Poll certification status until `CERTIFIED`

### Tatum fallback behavior

Anchoring first attempts the configured Tatum Sui RPC endpoint. If that fails, the backend falls back to:

- `https://fullnode.mainnet.sui.io:443`

This fallback is used only for transaction anchoring, not for Walrus upload.

## Walrus Integration

Walrus integration is implemented in [server/src/walrus.js](/C:/Users/singa/Downloads/veraAudit/server/src/walrus.js).

### What gets stored

Each audit blob includes:

- target package ID
- audit timestamp
- Gemini model info
- module snapshot
- transaction snapshot
- event snapshot
- RAG retrieval metadata
- summary
- severity
- safe-to-interact verdict
- findings
- confidence

### Upload behavior

1. The backend serializes the audit payload as JSON
2. It computes a deterministic filename
3. It uploads the file through Tatum's Walrus upload endpoint
4. It polls until the upload becomes `CERTIFIED`
5. It returns `quiltPatchId` or `blobId`

### Read behavior

Stored audit artifacts are read through the Walrus mainnet aggregator:

- `https://aggregator.walrus-mainnet.walrus.space/v1/blobs/by-quilt-patch-id/:quiltId`

### Why Walrus is used here

Walrus acts as the immutable evidence layer. Instead of storing the full audit payload on-chain, VeraAudit stores:

- the full report off-chain but immutable on Walrus
- the compact reference and hash on-chain

That makes verification cheaper and more practical while preserving audit traceability.

## Gemini Integration

Gemini integration is implemented in [server/src/gemini.js](/C:/Users/singa/Downloads/veraAudit/server/src/gemini.js).

### Models used

- Audit generation model
  - default from config: `gemini-2.5-flash`
- Embedding model for RAG
  - `gemini-embedding-001`

The actual runtime value comes from `.env`.

### What Gemini receives

Gemini gets a prompt containing:

- normalized module snapshot
- recent compacted transaction context
- recent event context
- retrieved RAG context
- explicit safety instructions
- a strict JSON schema

### What Gemini returns

The model must return JSON with:

- `summary`
- `severity`
- `safe_to_interact`
- `safe_to_interact_rationale`
- `findings`
- `positive_patterns`
- `confidence`

This is enforced through `responseMimeType: "application/json"` and a response schema.

## RAG Integration

RAG integration is implemented in [server/src/rag.js](/C:/Users/singa/Downloads/veraAudit/server/src/rag.js).

### Why RAG exists in this project

Generic LLM auditing is not enough for Sui Move because many important risks are domain-specific:

- object ownership misuse
- shared object safety
- capability leakage
- transfer semantics
- upgradeability assumptions
- Sui- and Move-specific authority patterns

RAG injects targeted security knowledge before Gemini evaluates the package.

### How retrieval works

1. Extract signals from normalized modules
   - module names
   - exposed functions
   - struct names
   - field names/types

2. Infer categories
   - access control
   - capability
   - object management
   - arithmetic
   - transfer
   - flash loan
   - input validation
   - upgradeability

3. Build retrieval queries from:
   - contract/package ID
   - function signatures
   - struct signatures
   - recent event types

4. Score the local knowledge base
   - embedding similarity when enabled
   - lexical similarity as baseline/fallback

5. Return top-k chunks
   - defaults to `RAG_TOP_K`

### RAG fallback behavior

If Gemini embedding calls fail, the system does not abort. It falls back to lexical retrieval and continues the audit.

## API Surface

The backend server lives in [server/src/index.js](/C:/Users/singa/Downloads/veraAudit/server/src/index.js).

### Public backend endpoints

#### `GET /api/health`

Returns:

- service health
- network label
- configured Tatum RPC URL
- configured Walrus aggregator
- flags showing whether critical configuration is present

#### `GET /api/test-tatum`

Tests the Tatum RPC connection by requesting the latest Sui checkpoint.

#### `GET /api/check/:contractId`

Loads prior anchored audit events for a contract/package from Sui and returns sorted audit history.

#### `GET /api/blob/:blobId`

Fetches the immutable audit artifact from Walrus.

#### `GET /api/verify/:blobId`

Verifies a Walrus blob against on-chain data by:

- fetching the blob
- looking up the matching Sui audit event
- recomputing SHA-256
- comparing it to the anchored on-chain hash

Returns whether the proof verifies.

#### `POST /api/audit`

Starts a new audit run and streams progress via SSE.

Request body:

```json
{
  "contractId": "0x..."
}
```

SSE event types:

- `progress`
- `step_log`
- `step_output`
- `complete`
- `error`

#### `GET /api/metrics`

Returns dashboard metrics:

- total audits
- unique contracts
- severity distribution
- recent audits

## Frontend Pages

### Landing page

- project positioning
- real audit metrics from `/api/metrics`
- architecture explanation
- RAG/Gemini/Tatum/Walrus explanation

### Audit workspace

- accepts a Sui package ID
- starts or inspects audits
- renders recent audit cards
- shows pipeline state and history

### Audit details page

- lists prior anchored audit events
- links contract, tx, and blob references
- renders the stored audit report

### Verify page

- loads an audit blob from Walrus
- compares its computed hash to the on-chain audit event

## Project Structure

```text
veraAudit/
|-- contracts/
|   |-- sources/registry.move
|   |-- Move.toml
|   `-- Published.toml
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- utils/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |   `-- styles.css
|   |-- index.html
|   `-- vite.config.js
|-- server/
|   |-- src/
|   |   |-- index.js
|   |   |-- auditPipeline.js
|   |   |-- anchor.js
|   |   |-- gemini.js
|   |   |-- rag.js
|   |   |-- ragKnowledge.js
|   |   |-- tatum.js
|   |   |-- tatumTransport.js
|   |   |-- walrus.js
|   |   `-- ...
|   `-- test/
|-- .env.example
|-- package.json
`-- README.md
```

## Setup and Installation

### Prerequisites

- Node.js 18+ recommended
- npm
- Tatum API key
- Gemini API key
- Sui private key for live anchoring

### 1. Clone and install

```bash
git clone <your-repo-url>
cd veraAudit
npm install
```

### 2. Configure environment

Copy the example file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then fill the required values.

### 3. Required environment variables

#### Server

- `PORT`
- `NODE_ENV`

#### Tatum RPC + Walrus

- `TATUM_API_KEY`
- `TATUM_SUI_RPC`
- `TATUM_WALRUS_UPLOAD_URL`
- `TATUM_WALRUS_STATUS_POLL_MS`
- `TATUM_WALRUS_STATUS_MAX_ATTEMPTS`
- `TATUM_MIN_INTERVAL_MS`

#### Gemini

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_EMBEDDING_DIMENSIONS`

#### Sui anchor configuration

- `REGISTRY_PACKAGE_ID`
- `REGISTRY_OBJECT_ID`
- `ADMIN_CAP_OBJECT_ID`
- `SUI_CLOCK_OBJECT_ID`
- `SUI_PRIVATE_KEY`
- `SUI_ANCHOR_RPC_FALLBACK`

#### Pipeline tuning

- `RETRY_MAX_ATTEMPTS`
- `RETRY_BASE_DELAY_MS`
- `RETRY_MAX_DELAY_MS`
- `CONTEXT_MODULE_QUERY_CONCURRENCY`
- `MAX_CONTEXT_FUNCTION_QUERIES`
- `CONTEXT_TRANSACTIONS_PER_FUNCTION`
- `MAX_CONTEXT_TRANSACTIONS`
- `MAX_CONTEXT_EVENTS`
- `MAX_MODULE_CHARS_FOR_AUDIT`
- `MAX_TRANSACTION_CHARS_FOR_AUDIT`
- `MAX_EVENT_CHARS_FOR_AUDIT`
- `MAX_RAG_CHARS_FOR_AUDIT`
- `RAG_ENABLED`
- `RAG_USE_EMBEDDINGS`
- `RAG_TOP_K`

### 4. Start the app

Run both frontend and backend:

```bash
npm run dev
```

Default local URLs:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4000`

The Vite frontend proxies `/api/*` to the backend.

## Build and Test

### Build

```bash
npm run build
```

### Backend tests

```bash
npm run test -w server
```

The backend test suite covers pipeline behavior including retry and RAG-related flows.

## How Verification Works

Verification is implemented through `/api/verify/:blobId`.

The verifier:

1. fetches the stored Walrus blob
2. loads Sui audit events
3. finds the event that references the same Walrus blob/quilt ID
4. recomputes `sha256(JSON.stringify(blob))`
5. compares that hash to the on-chain `audit_hash`

If the values match, the audit proof is considered valid.

## Important Implementation Notes

### Mainnet-first design

This project is configured around:

- Sui mainnet
- Walrus mainnet
- Tatum's mainnet Sui RPC

### Anchoring can be simulated

If the registry/private key configuration is missing, the backend still completes the audit flow but marks the anchor result as simulated.

### Walrus upload is Tatum-only

This codebase uploads to Walrus through Tatum's storage API. It does not contain a direct Mysten Walrus upload fallback.

### The app reads history from Sui events

Audit history is reconstructed from `AuditSubmitted` events rather than from a centralized database.

## Useful Files

- [server/src/index.js](/C:/Users/singa/Downloads/veraAudit/server/src/index.js)
- [server/src/auditPipeline.js](/C:/Users/singa/Downloads/veraAudit/server/src/auditPipeline.js)
- [server/src/gemini.js](/C:/Users/singa/Downloads/veraAudit/server/src/gemini.js)
- [server/src/rag.js](/C:/Users/singa/Downloads/veraAudit/server/src/rag.js)
- [server/src/walrus.js](/C:/Users/singa/Downloads/veraAudit/server/src/walrus.js)
- [server/src/anchor.js](/C:/Users/singa/Downloads/veraAudit/server/src/anchor.js)
- [server/src/tatum.js](/C:/Users/singa/Downloads/veraAudit/server/src/tatum.js)
- [contracts/sources/registry.move](/C:/Users/singa/Downloads/veraAudit/contracts/sources/registry.move)
- [frontend/src/pages/LandingPage.jsx](/C:/Users/singa/Downloads/veraAudit/frontend/src/pages/LandingPage.jsx)
- [frontend/src/pages/HomePage.jsx](/C:/Users/singa/Downloads/veraAudit/frontend/src/pages/HomePage.jsx)
- [frontend/src/pages/AuditPage.jsx](/C:/Users/singa/Downloads/veraAudit/frontend/src/pages/AuditPage.jsx)


