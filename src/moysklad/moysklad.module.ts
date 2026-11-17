import { Module } from '@nestjs/common';
import { MoyskladClient } from './moysklad.client.js';
import { MoyskladController } from './moysklad.controller.js';

@Module({
  providers: [MoyskladClient],
  exports: [MoyskladClient],
  controllers: [MoyskladController],
})
export class MoyskladModule {}
