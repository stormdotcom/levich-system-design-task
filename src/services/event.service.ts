import { paymentRepository } from '../repositories/payment.repository';
import { CreateEventDTO, CreateEventResponse, PaymentStatus, PaginatedResponse, PaymentRecord } from '../types';

export class EventService {
  async createEvent(dto: CreateEventDTO): Promise<CreateEventResponse> {
    const event = await paymentRepository.create(dto);

    return {
      id: event.id,
      status: event.status,
      message: 'Event accepted for processing',
    };
  }

  async getEventById(id: string): Promise<PaymentRecord | null> {
    const event = await paymentRepository.findById(id);
    if (!event) return null;

    return {
      id: event.id,
      target_url: event.target_url,
      payload: event.payload,
      status: event.status,
      attempted_count: event.attempted_count,
      next_attempt_at: event.next_attempt_at,
      created_at: event.created_at,
      last_attempted_at: event.last_attempted_at,
    };
  }

  async listEvents(status: PaymentStatus | undefined, page: number, limit: number): Promise<PaginatedResponse<PaymentRecord>> {
    const { rows, count } = await paymentRepository.findAll({ status }, page, limit);

    return {
      data: rows.map((r) => ({
        id: r.id,
        target_url: r.target_url,
        payload: r.payload,
        status: r.status,
        attempted_count: r.attempted_count,
        next_attempt_at: r.next_attempt_at,
        created_at: r.created_at,
        last_attempted_at: r.last_attempted_at,
      })),
      total: count,
      page,
      limit,
    };
  }
}

export const eventService = new EventService();
