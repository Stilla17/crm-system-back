import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({
  collection: 'companies',
  timestamps: true,
  versionKey: false,
})
export class Company {
  @Prop({
    type: String,
    default: () => randomUUID(),
    unique: true,
    required: true,
  })
  id: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  companyName: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
  })
  slug: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  color: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  type: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const CompanySchema = SchemaFactory.createForClass(Company);
