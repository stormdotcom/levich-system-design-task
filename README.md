# Webhook Dispatcher — Fintech System Design

## The problem

when a payment happens, we need to notify a merchant's server via http webhook. merchant servers time out, return 500s, and go offline for hours. if our own service crashes mid-retry, we can't lose the event.

## How i approached it

the core insight: don't use memory for anything you can't afford to lose.
instead of an in-memory queue, postgres is the queue. every event is a row. the dispatcher is a polling loop that reads from that table. if the process crashes, postgres still has the row. on restart, it picks up exactly where it left off.
the flow:
POST /events → write to db (status: pending) → return 202
↓
dispatcher polls every 5s
↓
attempt delivery with hmac signature
↓
success → mark succeeded failure → schedule retry (2^n backoff)
preventing duplicate processing across instances — two dispatcher instances could pick the same row simultaneously. solved with SELECT FOR UPDATE SKIP LOCKED. each instance locks different rows, skipping anything another instance is already working on.
preventing duplicate delivery after a crash — we update the db only after receiving a 200 response. if we crash between send and db-update, we resend on restart. this is fine — the requirement is at-least-once, and the merchant handles idempotency via event_id.
authentication — every outgoing request includes an X-Webhook-Signature header: an hmac-sha256 of the payload signed with a shared secret. the mock receiver verifies this on every request.

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
# 1. Clone and install
git clone https://github.com/stormdotcom/levich-system-design-task.git
cd levich-system-design-task
npm install

# 2. Create a .env file
cat > .env << 'EOF'
DATABASE_URL=postgres://postgres:<--your_password-->@localhost:5432/fintech
HMAC_SECRET=<--your_secret-->
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
  -e POSTGRES_DB=webhook_db \
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

| Variable             | Default                                 | Description                          |
| -------------------- | --------------------------------------- | ------------------------------------ |
| `DATABASE_URL`       | `postgres://...@localhost/webhook_db`   | PostgreSQL connection string         |
| `HMAC_SECRET`        | `super-secret-key-change-in-production` | Shared secret for HMAC-SHA256        |
| `TARGET_URL`         | `http://localhost:3001/webhook`         | Default webhook target URL           |
| `DISPATCHER_PORT`    | `3000`                                  | Port for the ingestion API           |
| `MOCK_RECEIVER_PORT` | `3001`                                  | Port for the mock receiver           |
| `POLL_INTERVAL_MS`   | `5000`                                  | Polling interval in milliseconds     |
| `MAX_ATTEMPTS`       | `10`                                    | Max retries before marking dead      |
| `HTTP_TIMEOUT_MS`    | `10000`                                 | HTTP request timeout in milliseconds |
| `BATCH_SIZE`         | `10`                                    | Max rows fetched per poll cycle      |

## Usage

### Send a webhook event

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

> When running locally (not Docker), use `http://localhost:3001/webhook` as the `target_url`.

### Health check

```bash
curl http://localhost:3000/health
```

### Send multiple events for testing

```bash
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:3000/events \
    -H "Content-Type: application/json" \
    -d "{\"target_url\": \"http://mock-receiver:3001/webhook\", \"payload\": {\"order\": $i}}"
  echo ""
done
```
