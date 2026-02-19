import dotenv from 'dotenv';
dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgres://webhook_user:webhook_pass@localhost:5432/fintech',
  hmacSecret: process.env.HMAC_SECRET || 'b78943f3976a7bacbbc6de236063817691e6e441be5b14acc7ba25fc0b6dfca2',
  targetUrl: process.env.TARGET_URL || 'http://localhost:3001/webhook',

  dispatcherPort: parseInt(process.env.DISPATCHER_PORT || '3000', 10),

  mockReceiverPort: parseInt(process.env.MOCK_RECEIVER_PORT || '3001', 10),

  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),

  maxAttempts: parseInt(process.env.MAX_ATTEMPTS || '10', 10),

  httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || '10000', 10),

  batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
};
