import axios from 'axios';
import { paymentRepository } from '../repositories/payment.repository';
import { LockedEvent, DeliveryResult } from '../types';
import { config } from '../config';
import { signPayload } from '../utils/hmac';
import { logAttempt, logger } from '../utils/logger';

export class DeliveryService {
  async deliverEvent(event: LockedEvent): Promise<void> {
    const attemptNumber = event.attempted_count + 1;
    const result = await this.attemptHttp(event);

    if (result.success) {
      await paymentRepository.markSucceeded(event.id, attemptNumber);
    } else {
      const isDead = attemptNumber >= config.maxAttempts;

      if (isDead) {
        await paymentRepository.markDead(event.id, attemptNumber);
      } else {
        const backoffSeconds = Math.pow(2, attemptNumber);
        const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
        await paymentRepository.markFailed(event.id, attemptNumber, nextAttemptAt);
      }
    }

    this.logResult(event, attemptNumber, result);
  }

  async fetchAndProcessBatch(): Promise<number> {
    const transaction = await paymentRepository.beginTransaction();

    try {
      const events = await paymentRepository.fetchPendingBatch(transaction);
      await transaction.commit();

      if (events.length > 0) {
        logger.info(`Picked up ${events.length} events for processing`);
        await Promise.all(events.map((event) => this.deliverEvent(event)));
      }

      return events.length;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  private async attemptHttp(event: LockedEvent): Promise<DeliveryResult> {
    const start = Date.now();

    try {
      const body = { ...event.payload, event_id: event.id };
      const signature = signPayload(body);

      const response = await axios.post(event.target_url, body, {
        timeout: config.httpTimeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        validateStatus: () => true, //TODO: more verbose logging 
      });

      const durationMs = Date.now() - start;
      const is2hundred = response.status >= 200 && response.status < 300;

      return {
        success: is2hundred,
        httpStatus: response.status,
        error: null,
        durationMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        httpStatus: null,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  private logResult(event: LockedEvent, attemptNumber: number, result: DeliveryResult): void {
    let nextRetryAt: string | null = null;

    if (!result.success) {
      const isDead = attemptNumber >= config.maxAttempts;
      if (isDead) {
        nextRetryAt = 'DEAD - max attempts reached';
      } else {
        const backoffSeconds = Math.pow(2, attemptNumber);
        nextRetryAt = `in ${backoffSeconds}s (${new Date(Date.now() + backoffSeconds * 1000).toISOString()})`;
      }
    }

    logAttempt({
      eventId: event.id,
      attempt: attemptNumber,
      targetUrl: event.target_url,
      httpStatus: result.httpStatus,
      error: result.error,
      durationMs: result.durationMs,
      nextRetryAt,
    });
  }
}

export const deliveryService = new DeliveryService();
