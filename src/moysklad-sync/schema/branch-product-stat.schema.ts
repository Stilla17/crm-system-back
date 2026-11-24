import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type BranchProductStatDocument = HydratedDocument<BranchProductStat>;

@Schema({
  collection: 'branch_product_stats',
  timestamps: true,
  versionKey: false,
})
export class BranchProductStat {
  @Prop({ type: String, required: true })
  retailStoreId: string;

  @Prop({ type: String, required: true })
  productId: string;

  @Prop({ type: String, required: true })
  productName: string;

  @Prop({ type: String })
  code?: string;

  @Prop({ type: String })
  article?: string;

  @Prop({ type: String, required: true })
  productType: string;

  @Prop({ type: Number, required: true, default: 0 })
  stock: number;

  @Prop({ type: Number, required: true, default: 0 })
  available: number;

  @Prop({ type: Number, required: true, default: 0 })
  inTransit: number;

  @Prop({ type: Date, default: null })
  lastSoldAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastReceivedAt?: Date | null;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  soldQuantity30Days: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  soldQuantity90Days: number;

  @Prop({ type: Boolean, required: true, default: true })
  isActive: boolean;

  @Prop({ type: String, required: true })
  lastSeenSyncId: string;

  @Prop({ type: Date, required: true })
  syncedAt: Date;

  @Prop({ type: Date })
  inactiveAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BranchProductStatSchema =
  SchemaFactory.createForClass(BranchProductStat);

BranchProductStatSchema.index(
  { retailStoreId: 1, productId: 1 },
  { unique: true },
);
BranchProductStatSchema.index({ retailStoreId: 1, isActive: 1, available: -1 });
BranchProductStatSchema.index({ retailStoreId: 1, isActive: 1, lastSoldAt: 1 });
BranchProductStatSchema.index(
  { inactiveAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
