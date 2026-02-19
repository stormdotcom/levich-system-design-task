import { AttemptLog } from '../types';

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (msg: string, meta?: unknown) => console.log(`${ts()} [INFO] ${msg}`, meta ? meta : ''),
  warn: (msg: string, meta?: unknown) => console.warn(`${ts()} [WARN] ${msg}`, meta ? meta : ''),
  error: (msg: string, meta?: unknown) => console.error(`${ts()} [ERROR] ${msg}`, meta ? meta : ''),
};

export function logAttempt(log: AttemptLog): void {
  const status = log.httpStatus !== null ? `status=${log.httpStatus}` : `error="${log.error}"`;
  const retry = log.nextRetryAt ? ` | next_retry=${log.nextRetryAt}` : '';
  logger.info(`[${log.eventId}] attempt #${log.attempt} → ${status} (${log.durationMs}ms)${retry}`);
}
