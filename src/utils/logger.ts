import path from 'path';
import winston from 'winston';
import { AttemptLog } from '../types';

const { combine, timestamp, printf, colorize, json } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]${metaStr} ${message}`;
});

const logFilePath = path.resolve(__dirname, '../../app.log');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: process.env.SERVICE_NAME || 'webhook-dispatcher' },
  transports: [
    new winston.transports.Console({
      format: isProduction ? combine(timestamp(), json()) : combine(timestamp({ format: 'HH:mm:ss.SSS' }), colorize(), devFormat),
    }),
    new winston.transports.File({
      filename: logFilePath,
      format: combine(timestamp(), json()),
    }),
  ],
});

export function logAttempt(log: AttemptLog): void {
  const meta: Record<string, unknown> = {
    eventId: log.eventId,
    attempt: log.attempt,
    targetUrl: log.targetUrl,
    durationMs: log.durationMs,
  };

  if (log.httpStatus !== null) meta.httpStatus = log.httpStatus;
  if (log.error !== null) meta.error = log.error;
  if (log.nextRetryAt) meta.nextRetryAt = log.nextRetryAt;

  const outcome = log.httpStatus !== null ? `status=${log.httpStatus}` : `error="${log.error}"`;
  const retryPart = log.nextRetryAt ? ` | next_retry=${log.nextRetryAt}` : '';

  logger.info(`attempt #${log.attempt} → ${outcome} (${log.durationMs}ms)${retryPart}`, meta);
}
