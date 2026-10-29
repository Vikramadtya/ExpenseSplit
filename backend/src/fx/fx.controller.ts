import { Controller, Get, Query } from '@nestjs/common';
import { FxService } from './fx.service';

@Controller('api/v1')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('fx/rates')
  rates(@Query('base') base = 'USD') {
    return this.fx.getRates(base);
  }
}
