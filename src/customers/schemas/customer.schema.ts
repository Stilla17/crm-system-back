import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type CustomerDocument = HydratedDocument<Customer>;

export enum ShipmentStatus {
  DRAFT = 'draft',
  DISPATCHED = 'dispatched',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Schema({
  collection: 'customers',
  timestamps: true,
  versionKey: false,
})
export class Customer {
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
  })
  bookId: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  customerName: string;

  @Prop({
    type: String,
    trim: true,
  })
  phone?: string;

  @Prop({
    type: String,
    trim: true,
  })
  address?: string;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  planAmount: number; //Reja summasi

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  cashAmount: number; //Naqd summasi

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  transferAmount: number; //O'tkazma summasi

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  debtAmount: number; // Qarz summasi

  createdAt: Date;
  updatedAt: Date;
}
export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ companyId: 1, customerName: 1 });
CustomerSchema.index({ companyId: 1, phone: 1 });
