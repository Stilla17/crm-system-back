import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
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
    default: null,
    index: true,
  })
  companyId?: string | null;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  roleId: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
    select: false,
  })
  password: string;

  @Prop({
    type: String,
    required: true,
    trim: false,
    lowercase: true,
    unique: true,
  })
  login: string;

  @Prop({
    type: String,
    default: 'active',
  })
  status: UserStatus;

  @Prop({ type: String, select: false, required: false })
  refreshToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
