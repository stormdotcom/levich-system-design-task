import express, { Request, Response } from 'express';
import http from 'http';
import { verifySignature } from '../utils/hmac';
import { config } from '../config';
import { logger } from '../utils/logger';

interface RawBodyRequest extends http.IncomingMessage {
  rawBody?: string;
}

const app = express();

app.use(
  express.json({
    verify: (req: http.IncomingMessage, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString();
    },
  }),
);

app.post('/webhook', async (req: Request, res: Response) => {
  const roll = Math.random();

  if (roll < 0.7) {
    const delayedFailure = Math.random() < 0.5;

    if (delayedFailure) {
      logger.warn(`DELAYED_FAILURE (roll=${roll.toFixed(3)}) — 12s delay then 500`);
      await new Promise((r) => setTimeout(r, 12000));
      res.status(500).json({ error: 'Simulated delayed failure' });
    } else {
      logger.warn(`IMMEDIATE_FAILURE (roll=${roll.toFixed(3)}) — instant 500`);
      res.status(500).json({ error: 'Simulated immediate failure' });
    }
  } else {
    const signature = req.headers['x-signature'] as string;
    const rawBody = (req as unknown as RawBodyRequest).rawBody;

    if (!signature || !rawBody) {
      logger.error('BAD_REQUEST — missing signature or body');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    try {
      const valid = verifySignature(rawBody, signature);
      if (valid) {
        logger.info(`SUCCESS (roll=${roll.toFixed(3)}) — signature verified`);
        res.status(200).json({ received: true });
      } else {
        logger.error(`SIGNATURE_MISMATCH (roll=${roll.toFixed(3)})`);
        res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      logger.error(`SIGNATURE_ERROR — ${String(err)}`);
      res.status(401).json({ error: 'Signature verification failed' });
    }
  }
});

app.listen(config.mockReceiverPort, () => {
  logger.info(`Listening on port ${config.mockReceiverPort}`);
});
