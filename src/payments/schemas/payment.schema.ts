import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({
  collection: 'payments',
  timestamps: true,
  versionKey: false,
})
export class Payment {
  @Prop({
    type: String,
    default: () => randomUUID(),
    unique: true,
  })
  id: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  companyId: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  customerId: string;

  @Prop({
    type: String,
    index: true,
  })
  shipmentId?: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  amount: number;

  @Prop({
    type: String,
    enum: PaymentMethod,
    required: true,
  })
  method: PaymentMethod;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.COMPLETED,
  })
  status: PaymentStatus;

  @Prop({
    type: Date,
    default: Date.now,
  })
  paidAt: Date;

  @Prop({
    type: String,
    trim: true,
  })
  comment?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({
  companyId: 1,
  customerId: 1,
  paidAt: -1,
});

PaymentSchema.index({
  companyId: 1,
  shipmentId: 1,
});
