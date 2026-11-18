import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type MoyskladSalesDocumentDocument =
  HydratedDocument<MoyskladSalesDocument>;

export type MoyskladSalesDocumentType =
  | 'retaildemand'
  | 'retailsalesreturn';

@Schema({
  collection: 'moysklad_sales_documents',
  timestamps: true,
  versionKey: false,
})
export class MoyskladSalesDocument {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  moyskladId: string;

  @Prop({
    type: String,
    required: true,
    enum: ['retaildemand', 'retailsalesreturn'],
    index: true,
  })
  documentType: MoyskladSalesDocumentType;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  retailStoreId: string;

  @Prop({
    type: Date,
    required: true,
    index: true,
  })
  moment: Date;

  @Prop({
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true,
  })
  date: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  sumMinor: number;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  applicable: boolean;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  isDeleted: boolean;

  @Prop({
    type: Date,
    required: true,
    index: true,
  })
  moyskladUpdatedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const MoyskladSalesDocumentSchema =
  SchemaFactory.createForClass(MoyskladSalesDocument);

MoyskladSalesDocumentSchema.index({
  retailStoreId: 1,
  date: 1,
});

MoyskladSalesDocumentSchema.index({
  documentType: 1,
  moyskladUpdatedAt: 1,
});