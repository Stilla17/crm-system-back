import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type ShipmentDocument = HydratedDocument<Shipment>;

export enum ShipmentStatus {
  DRAFT = 'draft',
  DISPATCHED = 'dispached',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Schema({
  _id: false,
})
export class ShipmentItem {
  @Prop({
    type: String,
    required: true,
  })
  bookId: string;

  // Jo'natma paytidagi kitob nomi
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  bookName: string;

  // Jo'natma paytidagi narx
  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  unitPrice: number;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  quantity: number;

  // unitPrice * quantity
  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  totalAmount: number;
}

export const ShipmentItemSchema = SchemaFactory.createForClass(ShipmentItem);

@Schema({
  collection: 'shipments',
  timestamps: true,
  versionKey: false,
})
export class Shipment {
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
    required: true,
    trim: true,
  })
  shipmentNumber: string;

  @Prop({
    type: [ShipmentItemSchema],
    required: true,
    validate: {
      validator: (items: ShipmentItem[]) => items.length > 0,
      message: 'Jo‘natmada kamida bitta kitob bo‘lishi kerak',
    },
  })
  items: ShipmentItem[];

  @Prop({
    type: Date,
    required: true,
  })
  deliveryTime: Date; // Yetkazib berish vaqti

  @Prop({
    type: Date,
    required: true,
  })
  dispatchTime: Date; // Jo'natish vaqti

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  totalAmount: number;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  pickupAddress: string; // Qabul qilish manzili

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  deliveryAddress: string; // Yetkazib berish manzili

  @Prop({
    type: String,
    enum: ShipmentStatus,
    default: ShipmentStatus.DRAFT,
  })
  status: ShipmentStatus;

  createdAt: Date;
  updatedAt: Date;
}
export const ShipmentSchema = SchemaFactory.createForClass(Shipment);

ShipmentSchema.index({
  companyId: 1,
  customerId: 1,
  deliveryTime: -1,
});

ShipmentSchema.index({
  companyId: 1,
  customerId: 1,
  createdAt: -1,
});
