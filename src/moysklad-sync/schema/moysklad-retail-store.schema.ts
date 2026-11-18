import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type MoyskladRetailStoreDocument = HydratedDocument<MoyskladRetailStore>;

@Schema({
  collection: 'moysklad_retail_stores',
  timestamps: true,
  versionKey: false,
})
export class MoyskladRetailStore {
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
  })
  name: string;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
    index: true,
  })
  archived: boolean;

  @Prop({
    type: String,
    required: false,
  })
  externalCode?: string;

  @Prop({
    type: String,
    required: true,
  })
  storeHref: string;

  @Prop({
    type: Date,
    required: true,
  })
  syncedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const MoyskladRetailStoreSchema =
  SchemaFactory.createForClass(MoyskladRetailStore);
