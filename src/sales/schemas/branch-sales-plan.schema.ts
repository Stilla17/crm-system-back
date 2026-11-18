import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type BranchSalesPlanDocument = HydratedDocument<BranchSalesPlan>;

@Schema({
  timestamps: true,
  collection: 'branch_sales_plan',
})
export class BranchSalesPlan {
  @Prop({
    type: String,
    required: true,
  })
  retailStoreId: string;

  @Prop({
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/,
  })
  month: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  amount: number;
}

export const BranchSalesPlanSchema =
  SchemaFactory.createForClass(BranchSalesPlan);

BranchSalesPlanSchema.index({ retailStoreId: 1, month: 1 }, { unique: true });
