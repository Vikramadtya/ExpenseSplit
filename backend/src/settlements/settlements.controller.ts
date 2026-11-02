import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { currencyCode } from '../common/money/currency-code.schema';

import { SettlementsService } from './settlements.service';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { CreateSettlementDto } from './dto/create-settlement.dto';

const GlobalSettlementSchema = z.object({
  payeeId: z.string().uuid(),
  amount: z.number().positive(),
  currency: currencyCode,
});

export class GlobalSettlementDto extends createZodDto(GlobalSettlementSchema) {}

@Controller('api/v1')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post('workspaces/:workspaceId/settlements')
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async recordSettlement(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlementsService.recordSettlement(workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/settlements')
  async listSettlements(@Param('workspaceId') workspaceId: string) {
    return this.settlementsService.listSettlements(workspaceId);
  }

  @Post('settlements/global')
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async recordGlobalSettlement(@Req() req: any, @Body() dto: GlobalSettlementDto) {
    return this.settlementsService.recordGlobalSettlement(
      req.user.id,
      dto.payeeId,
      dto.amount,
      dto.currency,
    );
  }
}
