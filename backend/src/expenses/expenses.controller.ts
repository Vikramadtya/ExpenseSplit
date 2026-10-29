import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('api/v1')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /** Returns one page of expenses; the cursor for the next page is in the `x-next-cursor` header. */
  @Get('workspaces/:workspaceId/expenses')
  async listWorkspaceExpenses(
    @Param('workspaceId') workspaceId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('q') q?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('currency') currency?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, nextCursor } = await this.expensesService.list(workspaceId, {
      q: q || search,
      tags,
      currency,
      from,
      to,
      cursor,
      limit: limit ? Number.parseInt(limit, 10) || undefined : undefined,
    });
    if (nextCursor) res.setHeader('x-next-cursor', nextCursor);
    return items;
  }

  @Post('workspaces/:workspaceId/expenses')
  @HttpCode(201)
  createExpense(
    @Param('workspaceId') workspaceId: string,
    @Body() data: CreateExpenseDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.expensesService.create(workspaceId, req.user.id, data);
  }

  @Get('expenses/:id')
  getExpense(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.expensesService.findOneWithUserAccess(id, req.user.id);
  }

  @Patch('expenses/:id')
  updateExpense(
    @Param('id') id: string,
    @Body() data: UpdateExpenseDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.expensesService.updateWithUserAccess(id, req.user.id, data);
  }

  @Post('expenses/:id/restore')
  @HttpCode(200)
  restoreExpense(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.expensesService.restoreWithUserAccess(id, req.user.id);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  async deleteExpense(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    await this.expensesService.removeWithUserAccess(id, req.user.id);
  }
}
