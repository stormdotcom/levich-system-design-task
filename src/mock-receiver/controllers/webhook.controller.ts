import { Request, Response } from 'express';
import { verifySignature } from '../../utils/hmac';
import { createLogger } from '../../utils/logger';
import { simulationService } from '../services/simulation.service';
import http from 'http';

const logger = createLogger('mock-receiver');

interface RawBodyRequest extends http.IncomingMessage {
  rawBody?: string;
}

export class WebhookController {
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const eventId = req.body?.event_id || 'unknown';
    const { shouldReject, shouldTimeout, delayMs, count } = simulationService.processAttempt(eventId);
    const failFirstN = simulationService.getFailFirstN();

    // simulate network latency/timeout
    if (delayMs > 0) {
        if (shouldTimeout) {
             logger.warn(`TIMEOUT_SIMULATION event=${eventId} attempt=${count} — sleeping ${delayMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // simulate network/server failure
    if (shouldReject) {
      logger.warn(`REJECTED event=${eventId} attempt=${count}/${failFirstN} — returning 500`);
      res.status(500).json({ error: 'Simulated failure' });
      return;
    }

    // validate signature (only if we didn't fail)
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
  }
}

export const webhookController = new WebhookController();
