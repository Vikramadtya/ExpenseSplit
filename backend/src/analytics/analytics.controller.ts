import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/v1')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('workspaces/:workspaceId/analytics')
  getWorkspaceAnalytics(@Param('workspaceId') workspaceId: string) {
    return this.analyticsService.getWorkspaceAnalytics(workspaceId);
  }

  @Get('analytics')
  getGlobalAnalytics() {
    return this.analyticsService.getWorkspaceAnalytics('');
  }
}
