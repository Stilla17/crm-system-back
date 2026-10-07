import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { HydratedDocument } from 'mongoose';

export type BookDocument = HydratedDocument<Book>;

@Schema({
  collection: 'books',
  timestamps: true,
  versionKey: false,
})
export class Book {
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

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  bookName: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  bookPrice: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  stockQuantity: number;

  createdAt: Date;
  updatedAt: Date;
}

export const BookSchema = SchemaFactory.createForClass(Book);

BookSchema.index({ companyId: 1, bookName: 1 }, { unique: true });
