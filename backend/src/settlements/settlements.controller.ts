import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Controller('api/v1/workspaces/:workspaceId/settlements')
@UsePipes(ZodValidationPipe)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordSettlement(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlementsService.recordSettlement(workspaceId, dto);
  }

  @Get()
  async listSettlements(@Param('workspaceId') workspaceId: string) {
    return this.settlementsService.listSettlements(workspaceId);
  }
}
