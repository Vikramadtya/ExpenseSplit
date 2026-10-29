import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Roles } from '../auth/decorators';
import { CATEGORIES } from '../common/categories';
import { BudgetsService } from './budgets.service';

export class SetBudgetDto extends createZodDto(
  z.object({
    category: z.enum(['ALL', ...CATEGORIES]).default('ALL'),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((c) => c.toUpperCase()),
    amount: z.number().finite().positive().max(9_999_999_999),
  }),
) {}

@Controller('api/v1/workspaces/:workspaceId/budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.budgets.list(workspaceId);
  }

  /** Sets (or changes) the monthly limit for a category or for everything. Admins only. */
  @Put()
  @Roles('ADMIN')
  set(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SetBudgetDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.budgets.set(workspaceId, req.user.id, dto);
  }

  @Delete(':budgetId')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(@Param('workspaceId') workspaceId: string, @Param('budgetId', ParseUUIDPipe) id: string) {
    return this.budgets.remove(workspaceId, id);
  }
}
