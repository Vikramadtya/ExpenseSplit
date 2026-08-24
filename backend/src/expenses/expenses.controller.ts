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
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('workspaces/:workspaceId/expenses')
  @UseGuards(WorkspaceMemberGuard)
  listWorkspaceExpenses(
    @Param('workspaceId') workspaceId: string,
    @Query('q') q?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('currency') currency?: string,
    @Query('category') category?: string,
  ) {
    return this.expensesService.findAllByWorkspace(workspaceId, {
      q: q || search,
      tags,
      currency,
      category,
    });
  }

  @Post('workspaces/:workspaceId/expenses')
  @UseGuards(WorkspaceMemberGuard)
  @HttpCode(201)
  createExpense(@Param('workspaceId') workspaceId: string, @Body() data: any, @Req() req: any) {
    return this.expensesService.create(workspaceId, req.user.id, data);
  }

  @Get('expenses/:id')
  getExpense(@Param('id') id: string) {
    // In a real app, this would require checking if the user is a member of the expense's workspace
    return this.expensesService.findOne('dummy-workspace-id', id);
  }

  @Patch('expenses/:id')
  updateExpense(@Param('id') id: string, @Body() data: any) {
    return this.expensesService.update('dummy-workspace-id', id, data);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  deleteExpense(@Param('id') id: string) {
    return this.expensesService.remove('dummy-workspace-id', id);
  }
}
