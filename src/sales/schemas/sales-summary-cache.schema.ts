import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { SalesSummaryResponse } from '../types/sales-summary.type.js';

export type SalesSummaryCacheDocument = HydratedDocument<SalesSummaryCache>;

@Schema({
  collection: 'sales_summary_cache',
  timestamps: true,
  versionKey: false,
})
export class SalesSummaryCache {
  @Prop({ type: String, required: true, unique: true, index: true })
  cacheKey: string;

  @Prop({ type: String, required: true, index: true })
  from: string;

  @Prop({ type: String, required: true, index: true })
  to: string;

  @Prop({ type: Object, required: true })
  data: SalesSummaryResponse;

  @Prop({ type: Date, required: true })
  syncedAt: Date;

  @Prop({ type: Date, required: true, index: true })
  refreshAfter: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const SalesSummaryCacheSchema =
  SchemaFactory.createForClass(SalesSummaryCache);

SalesSummaryCacheSchema.index({ from: 1, to: 1 });
