import { deliveryService } from '../services/delivery.service';
import { config } from '../config';
import { logger } from '../utils/logger';

async function pollAndProcess(): Promise<void> {
  try {
    await deliveryService.fetchAndProcessBatch();
  } catch (err) {
    logger.error(`Poll cycle error: ${err instanceof Error ? err.message : err}`);
  }
}

export function startDispatcher(): void {
  logger.info(`Dispatcher polling loop started (interval: ${config.pollIntervalMs}ms)`);

  async function loop(): Promise<void> {
    const usage = process.memoryUsage();
    logger.info(`Memory: HeapUsed=${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB RSS=${(usage.rss / 1024 / 1024).toFixed(2)}MB`);
    
    await pollAndProcess();
    setTimeout(loop, config.pollIntervalMs);
  }

  loop();
}
