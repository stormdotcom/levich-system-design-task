export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  DEAD = 'dead',
}

export interface CreateEventDTO {
  target_url: string;
  payload: Record<string, unknown>;
}

export interface CreateEventResponse {
  id: string;
  status: PaymentStatus;
  message: string;
}

export interface EventListQuery {
  status?: PaymentStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}


export interface PaymentRecord {
  id: string;
  target_url: string;
  payload: Record<string, unknown>;
  status: PaymentStatus;
  attempted_count: number;
  next_attempt_at: Date;
  created_at: Date;
  last_attempted_at: Date | null;
}

export interface LockedEvent {
  id: string;
  target_url: string;
  payload: Record<string, unknown>;
  status: PaymentStatus;
  attempted_count: number;
  next_attempt_at: Date;
  created_at: Date;
  last_attempted_at: Date | null;
}

export interface DeliveryResult {
  success: boolean;
  httpStatus: number | null;
  error: string | null;
  durationMs: number;
}


export interface AttemptLog {
  eventId: string;
  attempt: number;
  targetUrl: string;
  httpStatus: number | null;
  error: string | null;
  durationMs: number;
  nextRetryAt: string | null;
}
