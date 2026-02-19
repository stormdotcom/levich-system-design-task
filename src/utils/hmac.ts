import crypto from 'crypto';
import { config } from '../config';

export function signPayload(payload: Record<string, unknown>): string {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', config.hmacSecret).update(body).digest('hex');
}

export function verifySignature(payload: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', config.hmacSecret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
