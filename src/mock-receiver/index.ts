import express, { Request, Response } from 'express';
import http from 'http';
import { verifySignature } from '../utils/hmac';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('mock-receiver');

interface RawBodyRequest extends http.IncomingMessage {
  rawBody?: string;
}

const app = express();

// Track request count per event to simulate N failures then success
const attemptCounter = new Map<string, number>();
const FAIL_FIRST_N = parseInt(process.env.FAIL_FIRST_N || '5', 10);

app.use(
  express.json({
    verify: (req: http.IncomingMessage, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString();
    },
  }),
);

app.post('/webhook', (req: Request, res: Response) => {
  const eventId = req.body?.event_id || 'unknown';
  const count = (attemptCounter.get(eventId) || 0) + 1;
  attemptCounter.set(eventId, count);

  // Fail the first N attempts, succeed after that
  if (count <= FAIL_FIRST_N) {
    logger.warn(`REJECTED event=${eventId} attempt=${count}/${FAIL_FIRST_N} — returning 500`);
    res.status(500).json({ error: 'Simulated failure' });
    return;
  }

  const signature = req.headers['x-signature'] as string;
  const rawBody = (req as unknown as RawBodyRequest).rawBody;

  if (!signature || !rawBody) {
    logger.error(`BAD_REQUEST event=${eventId} — missing signature or body`);
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  const valid = verifySignature(rawBody, signature);
  if (valid) {
    logger.info(`ACCEPTED event=${eventId} attempt=${count} — signature verified`);
    res.status(200).json({ received: true });
  } else {
    logger.error(`SIGNATURE_MISMATCH event=${eventId}`);
    res.status(401).json({ error: 'Invalid signature' });
  }
});

app.listen(config.mockReceiverPort, () => {
  logger.info(`Mock receiver listening on :${config.mockReceiverPort} (fail first ${FAIL_FIRST_N} attempts)`);
});
