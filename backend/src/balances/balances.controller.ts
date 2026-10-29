import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { BalancesService } from './balances.service';

@Controller('api/v1')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('workspaces/:workspaceId/balances')
  getBalances(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
    @Query('convertTo') convertTo?: string,
  ) {
    return this.balancesService.getBalances(workspaceId, req.user.id, convertTo);
  }

  @Get('balances')
  getGlobalBalances(@Req() req: any, @Query('convertTo') convertTo?: string) {
    return this.balancesService.getBalances('', req.user.id, convertTo);
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
