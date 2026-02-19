import fs from 'fs';
import path from 'path';
import { AttemptLog } from '../types';

const LOG_DIR = path.resolve(__dirname, '../../logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const serviceName = process.env.SERVICE_NAME || 'dispatcher';
const logFile = path.join(LOG_DIR, `${serviceName}.log`);
const stream = fs.createWriteStream(logFile, { flags: 'a' });

function write(level: string, msg: string, meta?: unknown): void {
  const line = meta ? `${ts()} [${level}] ${msg} ${JSON.stringify(meta)}` : `${ts()} [${level}] ${msg}`;
  console.log(line);
  stream.write(line + '\n');
}

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (msg: string, meta?: unknown) => write('INFO', msg, meta),
  warn: (msg: string, meta?: unknown) => write('WARN', msg, meta),
  error: (msg: string, meta?: unknown) => write('ERROR', msg, meta),
};

export function logAttempt(log: AttemptLog): void {
  const status = log.httpStatus !== null ? `status=${log.httpStatus}` : `error="${log.error}"`;
  const outcome = log.nextRetryAt ? 'FAILED' : 'DELIVERED';
  const retry = log.nextRetryAt ? ` | retry ${log.nextRetryAt}` : '';
  logger.info(`${outcome} [${log.eventId}] attempt #${log.attempt} → ${status} (${log.durationMs}ms)${retry}`);
}
