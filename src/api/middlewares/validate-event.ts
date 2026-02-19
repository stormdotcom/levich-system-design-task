import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const createEventSchema = z
  .object({
    target_url: z.string().url(),
    payload: z.record(z.unknown()),
  })
  .passthrough();

export function validateCreateEvent(req: Request, res: Response, next: NextFunction): void {
  const result = createEventSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({ errors });
    return;
  }

  req.body = result.data;
  next();
}
