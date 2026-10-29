import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

export enum EmployeeSource {
  CRM = 'crm',
  VERIFIX = 'verifix',
}

export enum EmployeeSyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed',
}

export enum EmployeeGender {
  MALE = 'M',
  FEMALE = 'F',
}

@Schema({
  collection: 'employees',
  timestamps: true,
  versionKey: false,
})
export class Employee {
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
    index: true,
  })
  companyId: string;

  // CRM tizimiga kiradigan user bo‘lsa bog‘lanadi
  @Prop({
    type: String,
    default: null,
    index: true,
  })
  userId?: string | null;

  // Verifix qaytaradigan employee_id
  @Prop({
    type: String,
    default: null,
  })
  verifixEmployeeId?: string | null;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  firstName: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  lastName: string;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  middleName?: string | null;

  @Prop({
    type: String,
    enum: EmployeeGender,
    required: true,
  })
  gender: EmployeeGender;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  phone?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  birthDate?: string | null;

  // Verifix job_id
  @Prop({
    type: String,
    default: null,
  })
  jobId?: string | null;

  // Verifix division_id
  @Prop({
    type: String,
    default: null,
  })
  divisionId?: string | null;

  // Verifix location_id lar
  @Prop({
    type: [String],
    default: [],
  })
  locationIds: string[];

  @Prop({
    type: String,
    enum: EmployeeSource,
    default: EmployeeSource.CRM,
  })
  source: EmployeeSource;

  @Prop({
    type: String,
    enum: EmployeeSyncStatus,
    default: EmployeeSyncStatus.PENDING,
  })
  syncStatus: EmployeeSyncStatus;

  @Prop({
    type: String,
    default: null,
  })
  syncError?: string | null;

  @Prop({
    type: Date,
    default: null,
  })
  lastSyncedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
// Bitta Verifix xodimi bitta kompaniyada qayta yozilmasligi uchun
EmployeeSchema.index(
  {
    companyId: 1,
    verifixEmployeeId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      verifixEmployeeId: {
        $type: 'string',
      },
    },
  },
);

// Bitta CRM user bir kompaniyada faqat bitta employee bilan bog‘lanadi
EmployeeSchema.index(
  {
    companyId: 1,
    userId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      userId: {
        $type: 'string',
      },
    },
  },
);

EmployeeSchema.index({
  companyId: 1,
  createdAt: -1,
});

EmployeeSchema.index({
  createdAt: -1,
});
