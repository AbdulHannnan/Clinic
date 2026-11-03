import { Controller, Get } from '@nestjs/common';
import { ClinicService } from './clinic.service';

@Controller('clinic')
export class ClinicController {
  constructor(private readonly clinic: ClinicService) {}

  @Get()
  profile() {
    return this.clinic.publicProfile();
  }
}
