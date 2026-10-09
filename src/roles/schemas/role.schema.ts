import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';
import { RoleScope } from '../enum/role-scope.enum.js';

export type RoleDocument = HydratedDocument<Role>;

@Schema({
  collection: 'roles',
  timestamps: true,
  versionKey: false,
})
export class Role {
  @Prop({
    type: String,
    default: () => randomUUID(),
    unique: true,
  })
  id: string;

  @Prop({
    type: String,
    required: false,
    default: null,
    index: true,
  })
  companyId?: string | null;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  roleName: string;

  @Prop({
    type: String,
    enum: RoleScope,
    required: true,
  })
  scope: RoleScope;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  })
  slug: string;

  @Prop({
    type: [String],
    default: [],
  })
  permissions: string[];

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  createdAt: Date;

  updatedAt: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ companyId: 1, slug: 1 }, { unique: true });
