import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { VerifixListDto } from './dto/verifix-list.dto.js';
import { VerifixService } from './verifix.service.js';
import { SystemOnlyGuard } from '../auth/guards/system-only.guard.js';

@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@Controller('verifix')
export class VerifixController {
  constructor(private readonly verifixService: VerifixService) {}

  @Post('employees')
  getEmployees(@Body() dto: VerifixListDto) {
    return this.verifixService.listEmployees(dto);
  }

  @Post('tracks')
  getTracks(@Body() dto: VerifixListDto) {
    return this.verifixService.listTracks(dto);
  }

  @Post('locations')
  getLocations(@Body() dto: VerifixListDto) {
    return this.verifixService.listLocations(dto);
  }

  @Post('jobs')
  getJobs(@Body() dto: VerifixListDto) {
    return this.verifixService.listJobs(dto);
  }

  @Post('divisions')
  getDivisions(@Body() dto: VerifixListDto) {
    return this.verifixService.listDivisions(dto);
  }
}
