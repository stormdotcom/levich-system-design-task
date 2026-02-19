import express, { Request, Response } from 'express';
import winston from 'winston';
import { verifySignature } from '../utils/hmac';
import { config } from '../config';

const { combine, timestamp, printf, colorize, json } = winston.format;
const isProduction = process.env.NODE_ENV === 'production';

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]${metaStr} ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'mock-receiver' },
  transports: [
    new winston.transports.Console({
      format: isProduction ? combine(timestamp(), json()) : combine(timestamp({ format: 'HH:mm:ss.SSS' }), colorize(), devFormat),
    }),
  ],
});

const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

app.post('/webhook', async (req: Request, res: Response) => {
  const roll = Math.random();

  if (roll < 0.7) {
    const delayedFailure = Math.random() < 0.5;

    if (delayedFailure) {
      logger.warn('Simulating delayed failure', { outcome: 'DELAYED_FAILURE', behavior: '12s delay then 500', roll: roll.toFixed(3) });
      await new Promise((r) => setTimeout(r, 12000));
      res.status(500).json({ error: 'Simulated delayed failure' });
    } else {
      logger.warn('Simulating immediate failure', { outcome: 'IMMEDIATE_FAILURE', behavior: 'instant 500', roll: roll.toFixed(3) });
      res.status(500).json({ error: 'Simulated immediate failure' });
    }
  } else {
    const signature = req.headers['x-signature'] as string;
    const rawBody = (req as any).rawBody as string;

    if (!signature || !rawBody) {
      logger.error('Missing signature or body', { outcome: 'BAD_REQUEST' });
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    try {
      const valid = verifySignature(rawBody, signature);
      if (valid) {
        logger.info('Webhook received — signature verified', { outcome: 'SUCCESS', roll: roll.toFixed(3) });
        res.status(200).json({ received: true });
      } else {
        logger.error('Signature mismatch', { outcome: 'SIGNATURE_MISMATCH', roll: roll.toFixed(3) });
        res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      logger.error('Signature verification error', { outcome: 'SIGNATURE_ERROR', error: String(err) });
      res.status(401).json({ error: 'Signature verification failed' });
    }
  }
});

app.listen(config.mockReceiverPort, () => {
  logger.info(`Mock receiver listening on port ${config.mockReceiverPort}`);
});
