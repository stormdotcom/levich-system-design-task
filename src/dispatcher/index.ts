import express from 'express';
import morgan from 'morgan';
import { connectWithRetry, sequelize } from '../db/connection';
import { router } from '../api/routes';
import { errorHandler, notFoundHandler } from '../api/middlewares/error-handler';
import { startDispatcher } from '../worker/dispatcher';
import { config } from '../config';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  logger.info('Webhook Dispatcher starting...');

  await connectWithRetry();
  await sequelize.sync();
  logger.info('Database synced');

  const app = express();

  const morganStream = {
    write: (message: string) => logger.info(message.trim()),
  };
  app.use(morgan('combined', { stream: morganStream }));

  app.use(express.json());
  app.use(router);
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(config.dispatcherPort, () => {
    logger.info(`API listening on port ${config.dispatcherPort}`);
  });

  startDispatcher();
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});
