import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type BranchDailySalesDocument = HydratedDocument<BranchDailySales>;

@Schema({
  collection: 'branch_daily_sales',
  timestamps: true,
  versionKey: false,
})
export class BranchDailySales {
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  retailStoreId: string;

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
    default: 0,
    min: 0,
  })
  salesMinor: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  retailSalesMinor: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  shipmentSalesMinor: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  returnsMinor: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  netSalesMinor: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  salesDocumentCount: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  returnDocumentCount: number;

  @Prop({
    type: Date,
    required: true,
  })
  syncedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BranchDailySalesSchema =
  SchemaFactory.createForClass(BranchDailySales);

BranchDailySalesSchema.index(
  {
    retailStoreId: 1,
    date: 1,
  },
  {
    unique: true,
  },
);

BranchDailySalesSchema.index({
  date: 1,
  retailStoreId: 1,
});
