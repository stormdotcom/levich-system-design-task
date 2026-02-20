import express from 'express';
import http from 'http';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { router } from './routes';
import { simulationService } from './services/simulation.service';

const logger = createLogger('mock-receiver');

interface RawBodyRequest extends http.IncomingMessage {
  rawBody?: string;
}

const app = express();
const FAIL_FIRST_N = simulationService.getFailFirstN();

app.use(
  express.json({
    verify: (req: http.IncomingMessage, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString();
    },
  }),
);

app.use(router);

app.listen(config.mockReceiverPort, () => {
  logger.info(`Mock receiver listening on :${config.mockReceiverPort} (fail first ${FAIL_FIRST_N} attempts)`);
});
