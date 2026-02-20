import { Router } from 'express';
import { webhookController } from './controllers/webhook.controller';
import { Request, Response, NextFunction } from 'express';

const router = Router();

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/webhook', asyncHandler((req: Request, res: Response) => webhookController.handleWebhook(req, res)));

export { router };
