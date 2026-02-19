import fs from 'fs';
import path from 'path';
import { AttemptLog } from '../types';

const LOG_DIR = path.join(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

function ts(): string {
  return new Date().toISOString();
}

interface Logger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
}

export function createLogger(serviceName: string): Logger {
  const logFile = path.join(LOG_DIR, `${serviceName}.log`);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });

  function write(level: string, msg: string, meta?: unknown): void {
    const line = meta ? `${ts()} [${level}] ${msg} ${JSON.stringify(meta)}` : `${ts()} [${level}] ${msg}`;
    console.log(line);
    stream.write(line + '\n');
  }

  return {
    info: (msg: string, meta?: unknown) => write('INFO', msg, meta),
    warn: (msg: string, meta?: unknown) => write('WARN', msg, meta),
    error: (msg: string, meta?: unknown) => write('ERROR', msg, meta),
  };
}

// Default logger for the dispatcher (used by services, worker, etc.)
export const logger = createLogger('dispatcher');

export function logAttempt(log: AttemptLog): void {
  const status = log.httpStatus !== null ? `status=${log.httpStatus}` : `error="${log.error}"`;
  const outcome = log.nextRetryAt ? 'FAILED' : 'DELIVERED';
  const retry = log.nextRetryAt ? ` | retry ${log.nextRetryAt}` : '';
  logger.info(`${outcome} [${log.eventId}] attempt #${log.attempt} → ${status} (${log.durationMs}ms)${retry}`);
}
