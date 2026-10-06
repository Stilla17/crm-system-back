import { Module } from '@nestjs/common';
import { Book, BookSchema } from './schemas/book.schema.js';
import { MongooseModule } from '@nestjs/mongoose';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]),
  ],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService, MongooseModule],
})
export class BooksModule {}
