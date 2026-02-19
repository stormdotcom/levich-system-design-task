import { AttemptLog } from '../types';

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (msg: string) => console.log(`${ts()} [INFO] ${msg}`),
  warn: (msg: string) => console.warn(`${ts()} [WARN] ${msg}`),
  error: (msg: string) => console.error(`${ts()} [ERROR] ${msg}`),
};

export function logAttempt(log: AttemptLog): void {
  const status = log.httpStatus !== null ? `status=${log.httpStatus}` : `error="${log.error}"`;
  const retry = log.nextRetryAt ? ` | next_retry=${log.nextRetryAt}` : '';
  logger.info(`[${log.eventId}] attempt #${log.attempt} → ${status} (${log.durationMs}ms)${retry}`);
}
