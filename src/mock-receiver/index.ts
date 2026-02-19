import express, { Request, Response } from 'express';
import http from 'http';
import { verifySignature } from '../utils/hmac';
import { config } from '../config';

interface RawBodyRequest extends http.IncomingMessage {
  rawBody?: string;
}

const log = (msg: string) => console.log(`${new Date().toISOString()} [mock-receiver] ${msg}`);

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
      log(`DELAYED_FAILURE (roll=${roll.toFixed(3)}) — 12s delay then 500`);
      await new Promise((r) => setTimeout(r, 12000));
      res.status(500).json({ error: 'Simulated delayed failure' });
    } else {
      log(`IMMEDIATE_FAILURE (roll=${roll.toFixed(3)}) — instant 500`);
      res.status(500).json({ error: 'Simulated immediate failure' });
    }
  } else {
    const signature = req.headers['x-signature'] as string;
    const rawBody = (req as unknown as RawBodyRequest).rawBody;

    if (!signature || !rawBody) {
      log('BAD_REQUEST — missing signature or body');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    try {
      const valid = verifySignature(rawBody, signature);
      if (valid) {
        log(`SUCCESS (roll=${roll.toFixed(3)}) — signature verified`);
        res.status(200).json({ received: true });
      } else {
        log(`SIGNATURE_MISMATCH (roll=${roll.toFixed(3)})`);
        res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      log(`SIGNATURE_ERROR — ${String(err)}`);
      res.status(401).json({ error: 'Signature verification failed' });
    }
  }
});

app.listen(config.mockReceiverPort, () => {
  log(`Listening on port ${config.mockReceiverPort}`);
});
