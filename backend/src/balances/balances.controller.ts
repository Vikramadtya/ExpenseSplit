import { Controller, Get, Param, Query } from '@nestjs/common';
import { BalancesService } from './balances.service';

@Controller('api/v1')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('workspaces/:workspaceId/balances')
  getBalances(@Param('workspaceId') workspaceId: string) {
    return this.balancesService.getBalances(workspaceId);
  }

  @Get('balances')
  getGlobalBalances() {
    return this.balancesService.getBalances('');
  }

  @Get('workspaces/:workspaceId/balances/debts')
  getDebts(@Param('workspaceId') workspaceId: string, @Query('simplified') simplified?: string) {
    const isSimplified = simplified !== 'false';
    return this.balancesService.getDebts(workspaceId, isSimplified);
  }

  @Get('balances/friends')
  getFriendsBalances() {
    return this.balancesService.getFriendsBalances();
  }
}
