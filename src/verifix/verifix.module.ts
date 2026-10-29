import { Module } from '@nestjs/common';
import { VerifixController } from './verifix.controller.js';
import { VerifixService } from './verifix.service.js';

@Module({
  controllers: [VerifixController],
  providers: [VerifixService],
  exports: [VerifixService],
})
export class VerifixModule {}