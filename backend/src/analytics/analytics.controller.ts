import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { AnalyticsQueryDto } from './analytics-query.dto';
import { AnalyticsService } from './analytics.service';

type Authed = { user: { id: string } };

@Controller('api/v1')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('workspaces/:workspaceId/analytics')
  forWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @Req() req: Authed,
  ) {
    return this.analytics.forWorkspace(workspaceId, req.user.id, query);
  }

  @Get('analytics')
  forUser(@Query() query: AnalyticsQueryDto, @Req() req: Authed) {
    return this.analytics.forUser(req.user.id, query);
  }

  @Get('workspaces/:workspaceId/tags')
  tags(@Param('workspaceId') workspaceId: string) {
    return this.analytics.tags(workspaceId);
  }
}
