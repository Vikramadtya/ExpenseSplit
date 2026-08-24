import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  async getWorkspaceAnalytics(workspaceId: string) {
    // TODO: Implement actual database aggregation for advanced analytics.
    // Group by currency, compute true spending (amountOwed), cashOut (amountPaid), etc.
    return {
      byCurrency: [
        {
          currency: 'USD',
          totalSpend: 1700.5,
          expenseCount: 3,

          // New Advanced Analytics fields requested by User
          trueSpending: 850.25,
          cashOut: 1200.0,
          received: 200.0,
          paid: 50.0,
          todaySpend: 45.0,
          thisMonthSpend: 1700.5,

          spendByMember: [
            { userId: 'dev-user-id', name: 'You', amount: 850.25 },
            { userId: 'user-2', name: 'Alice', amount: 850.25 },
          ],
          spendOverTime: [
            { date: '2024-06-10', amount: 1200 },
            { date: '2024-06-13', amount: 180.5 },
            { date: '2024-06-14', amount: 320 },
          ],
          topCategories: [
            { description: 'Accommodation', count: 1, total: 1200 },
            { description: 'Food & Drink', count: 1, total: 320 },
            { description: 'Groceries', count: 1, total: 180.5 },
          ],
          tagsAnalysis: [
            { tag: 'trip2024', total: 1200 },
            { tag: 'groceries', total: 180.5 },
          ],
        },
      ],
    };
  }

  async getGlobalAnalytics(userId: string) {
    // TODO: Same aggregation but without filtering by workspaceId
    return this.getWorkspaceAnalytics('');
  }
}
