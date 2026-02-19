# Webhook Dispatcher — Fintech System Design

## The Problem

When a payment happens, we need to notify a merchant's server via an HTTP webhook. Merchant servers time out, return 500s, and go offline for hours. If our own service crashes mid-retry, we can't lose the event.

## Approach & Solution

### Core Insight
**Don't use memory for anything you can't afford to lose.**
Instead of an in-memory queue, PostgreSQL is the queue. Every event is a row. The dispatcher is a polling loop that reads from that table. If the process crashes, PostgreSQL still has the row. On restart, it picks up exactly where it left off.

### The Flow
1.  **Ingestion:** `POST /events` → Write to DB (status: `pending`) → Return `202 Accepted`.
2.  **Polling:** Dispatcher polls every 5s for pending events.
3.  **Delivery:** Attempt delivery with HMAC signature.
4.  **Result:**
    *   **Success (2xx):** Mark as `succeeded`.
    *   **Failure:** Schedule retry (exponential backoff: 2s, 4s, 8s...).

### Reliability Features
*   **Preventing Duplicate Processing:** Solved with `SELECT FOR UPDATE SKIP LOCKED`. This allows multiple dispatcher instances to run simultaneously without picking up the same row.
*   **Preventing Data Loss:** We update the DB status only *after* receiving a response. If we crash between sending and updating, we resend on restart (At-Least-Once delivery).
*   **Idempotency:** The merchant handles idempotency via the unique `event_id`.
*   **Authentication:** Every outgoing request includes an `X-Signature` header (HMAC-SHA256 of the payload signed with a shared secret).

## Project Structure

```
src/
├── types/                 # Shared TypeScript types and enums
│   └── index.ts
├── config/                # Environment-driven configuration
│   └── index.ts
├── db/
│   ├── connection.ts      # Sequelize connection with retry
│   └── models/
│       └── Payment.ts     # Payment model definition
├── utils/
│   ├── hmac.ts            # HMAC-SHA256 sign and verify
│   └── logger.ts          # Structured attempt logger
├── api/
│   └── routes.ts          # POST /events ingestion endpoint
├── worker/
│   └── dispatcher.ts      # Polling loop and delivery logic
├── dispatcher/
│   └── index.ts           # Entry point: API + worker
└── mock-receiver/
    └── index.ts           # Chaos mock server
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- (Optional for local dev) [Node.js 20+](https://nodejs.org/) and npm

## Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/stormdotcom/levich-system-design-task.git
cd levich-system-design-task

# 2. Start all services
docker compose up --build
```

This starts three containers:

| Service         | Port | Description                     |
| --------------- | ---- | ------------------------------- |
| `postgres`      | 5432 | PostgreSQL 16 database          |
| `dispatcher`    | 3000 | Express API + background worker |
| `mock-receiver` | 3001 | Chaos mock webhook receiver     |

The dispatcher waits for PostgreSQL to be healthy before starting.

## Local Development (without Docker)

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file
cat > .env << 'EOF'
DATABASE_URL=postgres://webhook_user:webhook_pass@localhost:5432/fintech
HMAC_SECRET=b78943f3976a7bacbbc6de236063817691e6e441be5b14acc7ba25fc0b6dfca2
TARGET_URL=http://localhost:3001/webhook
DISPATCHER_PORT=3000
MOCK_RECEIVER_PORT=3001
POLL_INTERVAL_MS=5000
MAX_ATTEMPTS=10
HTTP_TIMEOUT_MS=10000
BATCH_SIZE=10
EOF

# 3. Start PostgreSQL (use Docker or a local instance)
docker run -d --name webhook-pg \
  -e POSTGRES_USER=webhook_user \
  -e POSTGRES_PASSWORD=webhook_pass \
  -e POSTGRES_DB=fintech \
  -p 5432:5432 \
  postgres:16-alpine

# 4. Build TypeScript
npm run build

# 5. Start mock receiver (in one terminal)
npm run start:mock-receiver

# 6. Start dispatcher (in another terminal)
npm run start:dispatcher
```

## Environment Variables

| Variable             | Default                                     | Description                          |
| -------------------- | ------------------------------------------- | ------------------------------------ |
| `DATABASE_URL`       | `postgres://...@localhost/fintech`          | PostgreSQL connection string         |
| `HMAC_SECRET`        | `...` (32 bytes hex)                        | Shared secret for HMAC-SHA256        |
| `TARGET_URL`         | `http://localhost:3001/webhook`             | Default webhook target URL           |
| `DISPATCHER_PORT`    | `3000`                                      | Port for the ingestion API           |
| `MOCK_RECEIVER_PORT` | `3001`                                      | Port for the mock receiver           |
| `POLL_INTERVAL_MS`   | `5000`                                      | Polling interval in milliseconds     |
| `MAX_ATTEMPTS`       | `10`                                        | Max retries before marking dead      |
| `HTTP_TIMEOUT_MS`    | `10000`                                     | HTTP request timeout in milliseconds |
| `BATCH_SIZE`         | `10`                                        | Max rows fetched per poll cycle      |

## Usage

### Send a Webhook Event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "http://mock-receiver:3001/webhook",
    "payload": { "order_id": "abc-123", "amount": 99.99 }
  }'
```

Response (`202 Accepted`):

```json
{
  "id": "d4f7a8b2-...",
  "status": "pending",
  "message": "Event accepted for processing"
}
```

> **Note:** When running locally (not Docker), use `http://localhost:3001/webhook` as the `target_url`.

### Health Check

```bash
curl http://localhost:3000/health
```

### Send Multiple Events (Load Test)

```bash
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:3000/events \
    -H "Content-Type: application/json" \
    -d "{\"target_url\": \"http://mock-receiver:3001/webhook\", \"payload\": {\"order\": $i}}"
  echo ""
done
```
### Proof of work sample,
<img width="1882" height="475" alt="image" src="https://github.com/user-attachments/assets/345b110d-09ab-4acf-b5da-a629ac869b06" />
