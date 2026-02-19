import { Request, Response } from 'express';
import { eventService } from '../../services/event.service';
import { CreateEventDTO, PaymentStatus } from '../../types';

export class EventController {
  async create(req: Request, res: Response): Promise<void> {
    const dto: CreateEventDTO = {
      target_url: req.body.target_url,
      payload: req.body.payload,
    };

    const result = await eventService.createEvent(dto);
    res.status(202).json(result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const event = await eventService.getEventById(id);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(event);
  }

  async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as PaymentStatus | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await eventService.listEvents(status, page, limit);
    res.json(result);
  }
}

export const eventController = new EventController();
