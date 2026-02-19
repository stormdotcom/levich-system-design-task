import { Sequelize } from 'sequelize';
import { config } from '../config';
import { logger } from '../utils/logger';

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
});

export async function connectWithRetry(maxRetries = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection established');
      return;
    } catch (err) {
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delayMs}ms...`);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
