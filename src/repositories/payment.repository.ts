import { v4 as uuidv4 } from 'uuid';
import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../db/connection';
import { Payment } from '../db/models/Payment';
import { CreateEventDTO, LockedEvent, PaymentStatus } from '../types';
import { config } from '../config';

export class PaymentRepository {
  async create(dto: CreateEventDTO): Promise<Payment> {
    return Payment.create({
      id: uuidv4(),
      target_url: dto.target_url,
      payload: dto.payload,
      status: PaymentStatus.PENDING,
      next_attempt_at: new Date(),
    });
  }

  async findById(id: string): Promise<Payment | null> {
    return Payment.findByPk(id);
  }

  async findAll(filters: { status?: PaymentStatus }, page: number, limit: number): Promise<{ rows: Payment[]; count: number }> {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;

    return Payment.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
  }

  async fetchPendingBatch(transaction: Transaction): Promise<LockedEvent[]> {
    return sequelize.query<LockedEvent>(
      `SELECT * FROM payments
       WHERE status = 'pending' AND next_attempt_at <= NOW()
       ORDER BY next_attempt_at ASC
       LIMIT :limit
       FOR UPDATE SKIP LOCKED`,
      {
        replacements: { limit: config.batchSize },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
  }

  async markSucceeded(id: string, attemptNumber: number, transaction?: Transaction): Promise<void> {
    await Payment.update(
      {
        status: PaymentStatus.SUCCEEDED,
        attempted_count: attemptNumber,
        last_attempted_at: new Date(),
      },
      { where: { id }, transaction },
    );
  }

  async markFailed(id: string, attemptNumber: number, nextAttemptAt: Date, transaction?: Transaction): Promise<void> {
    await Payment.update(
      {
        status: PaymentStatus.PENDING,
        attempted_count: attemptNumber,
        last_attempted_at: new Date(),
        next_attempt_at: nextAttemptAt,
      },
      { where: { id }, transaction },
    );
  }

  async markDead(id: string, attemptNumber: number, transaction?: Transaction): Promise<void> {
    await Payment.update(
      {
        status: PaymentStatus.DEAD,
        attempted_count: attemptNumber,
        last_attempted_at: new Date(),
      },
      { where: { id }, transaction },
    );
  }

  async beginTransaction(): Promise<Transaction> {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });
  }
}

export const paymentRepository = new PaymentRepository();
