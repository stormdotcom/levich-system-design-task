import { Router } from 'express';
import { eventController } from './controllers/event.controller';
import { validateCreateEvent } from './middlewares/validate-event';
import { asyncHandler } from './middlewares/async-handler';

const router = Router();

router.post(
  '/events',
  validateCreateEvent,
  asyncHandler((req, res) => eventController.create(req, res)),
);
router.get(
  '/events',
  asyncHandler((req, res) => eventController.list(req, res)),
);
router.get(
  '/events/:id',
  asyncHandler((req, res) => eventController.getById(req, res)),
);

export { router };
