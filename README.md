# Webhook Dispatcher — Fintech System Design

## The Problem

When a payment happens, we need to notify a merchant's server via an HTTP webhook. Merchant servers time out, return 500s, and go offline for hours. If our own service crashes mid-retry, we can't lose the event.

## Approach & Solution

### Core Insight

**Don't use memory for anything can't afford to lose.**
Instead of an in-memory queue, PostgreSQL is the queue. Every event is a row. The dispatcher is a polling loop that reads from that table. If the process crashes, PostgreSQL still has the row. On restart, it picks up exactly where it left off.

### The Flow

1.  **Ingestion:** `POST /events` → Write to DB (status: `pending`) → Return `202 Accepted`.
2.  **Polling:** Dispatcher polls every 5s for pending events.
3.  **Delivery:** Attempt delivery with HMAC signature( for identification of sender)
4.  **Result:**
    - **Success (2xx):** Mark as `succeeded`.
    - **Failure:** Schedule retry (exponential backoff: 2s, 4s, 8s...).

### Reliability Features

- **Preventing Duplicate Processing:** Solved with `SELECT FOR UPDATE SKIP LOCKED`. This allows multiple dispatcher instances to run simultaneously without picking up the same row.
- **Preventing Data Loss:** We update the DB status only _after_ receiving a response. If we crash between sending and updating, we resend on restart (At-Least-Once delivery).
- **Idempotency:** The merchant handles idempotency via the unique `event_id`.
- **Authentication:** Every outgoing request includes an `X-Signature` header (HMAC-SHA256 of the payload signed with a shared secret).

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
- (Optional for local dev) [v22.14.0 or 22+](https://nodejs.org/) and npm

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

| Variable             | Default                            | Description                          |
| -------------------- | ---------------------------------- | ------------------------------------ |
| `DATABASE_URL`       | `postgres://...@localhost/fintech` | PostgreSQL connection string         |
| `HMAC_SECRET`        | `...` (32 bytes hex)               | Shared secret for HMAC-SHA256        |
| `TARGET_URL`         | `http://localhost:3001/webhook`    | Default webhook target URL           |
| `DISPATCHER_PORT`    | `3000`                             | Port for the ingestion API           |
| `MOCK_RECEIVER_PORT` | `3001`                             | Port for the mock receiver           |
| `POLL_INTERVAL_MS`   | `5000`                             | Polling interval in milliseconds     |
| `MAX_ATTEMPTS`       | `10`                               | Max retries before marking dead      |
| `HTTP_TIMEOUT_MS`    | `10000`                            | HTTP request timeout in milliseconds |
| `BATCH_SIZE`         | `10`                               | Max rows fetched per poll cycle      |

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

## Postman Collection

A ready-to-use Postman collection is included at `postman/Fintech_Webhook_Dispatcher.postman_collection.json`.

**To import:**

1. Open Postman
2. Click **Import** (top-left)
3. Drag or browse to `postman/Fintech_Webhook_Dispatcher.postman_collection.json`
4. The collection uses a `{{base_url}}` variable defaulting to `http://localhost:3000`

**Included requests:**

| Request         | Method | Endpoint      | Description                                                      |
| --------------- | ------ | ------------- | ---------------------------------------------------------------- |
| Create Event    | POST   | `/events`     | Submit a webhook event with `target_url` and `payload`           |
| List Events     | GET    | `/events`     | List all events; optional `status`, `page`, `limit` query params |
| Get Event by ID | GET    | `/events/:id` | Fetch a single event by its UUID                                 |
| Health Check    | GET    | `/health`     | Returns `{ status: "ok" }`                                       |

## Logs

Each service writes to its own log file under the shared `logs/` Docker volume:

- `logs/dispatcher.log` — event pickup, delivery attempts, backoff schedule
- `logs/mock-receiver.log` — incoming requests, rejections, and acceptances

View logs from Docker:

```bash
docker compose exec dispatcher cat /app/logs/dispatcher.log
docker compose exec mock-receiver cat /app/logs/mock-receiver.log
```

## Example Output & Logs

### 1. Delivery & Retry Logic (Console Output)

<img width="1882" height="475" alt="Dispatcher Console Output" src="https://github.com/user-attachments/assets/345b110d-09ab-4acf-b5da-a629ac869b06" />

### 2. Dispatcher Service Logs

<img width="1382" height="543" alt="Dispatcher Service Logs" src="https://github.com/user-attachments/assets/d3192ffd-f99d-45d6-a053-e577399b1c72" />

### 3. Mock Receiver Logs

<img width="1102" height="356" alt="Mock Receiver Logs" src="https://github.com/user-attachments/assets/c5526143-6f4d-4297-8041-c1cd88d0f2c9" />
