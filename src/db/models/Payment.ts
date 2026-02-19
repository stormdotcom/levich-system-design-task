import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { PaymentStatus } from '../../types';

interface PaymentAttributes {
  id: string;
  target_url: string;
  payload: Record<string, unknown>;
  status: PaymentStatus;
  attempted_count: number;
  next_attempt_at: Date;
  created_at: Date;
  last_attempted_at: Date | null;
}

type PaymentCreationAttributes = Optional<PaymentAttributes, 'status' | 'attempted_count' | 'created_at' | 'last_attempted_at'>;

export class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  declare id: string;
  declare target_url: string;
  declare payload: Record<string, unknown>;
  declare status: PaymentStatus;
  declare attempted_count: number;
  declare next_attempt_at: Date;
  declare created_at: Date;
  declare last_attempted_at: Date | null;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    target_url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false,
      defaultValue: PaymentStatus.PENDING,
    },
    attempted_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    next_attempt_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_attempted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'payments',
    timestamps: false,
    indexes: [
      {
        fields: ['status', 'next_attempt_at'],
        where: { status: PaymentStatus.PENDING },
      },
    ],
  },
);
