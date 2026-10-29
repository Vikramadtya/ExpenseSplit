import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BalancesService } from './balances.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('workspaces/:workspaceId/balances')
  getBalances(@Param('workspaceId') workspaceId: string) {
    return this.balancesService.getBalances(workspaceId);
  }

  @Get('balances')
  getGlobalBalances(@Req() req: any) {
    return this.balancesService.getBalances('', req.user.id);
  }

  @Get('workspaces/:workspaceId/balances/debts')
  getDebts(@Param('workspaceId') workspaceId: string, @Query('simplified') simplified?: string) {
    const isSimplified = simplified !== 'false';
    return this.balancesService.getDebts(workspaceId, isSimplified);
  }

  @Get('balances/friends')
  getFriendsBalances(@Req() req: any) {
    return this.balancesService.getFriendsBalances(req.user.id);
  }
}
