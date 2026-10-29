import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const GlobalSettlementSchema = z.object({
  payeeId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
});

export class GlobalSettlementDto extends createZodDto(GlobalSettlementSchema) {}

@Controller('api/v1')
@UsePipes(ZodValidationPipe)
@UseGuards(JwtAuthGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post('workspaces/:workspaceId/settlements')
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
