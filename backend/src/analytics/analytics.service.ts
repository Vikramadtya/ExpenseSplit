import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getWorkspaceAnalytics(workspaceId: string) {
    if (!workspaceId) return { byCurrency: [] };

    const analytics = await this.repository.getWorkspaceAnalytics(workspaceId);
    if (!analytics) throw new NotFoundException('Workspace not found');

    return analytics;
  }

  async getGlobalAnalytics(userId: string) {
    return { byCurrency: [] }; // Future feature
  }
}
