import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrometheusModule, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import {
  HTTP_DURATION_METRIC,
  HttpMetricsMiddleware,
} from './common/middleware/http-metrics.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BalancesModule } from './balances/balances.module';
import { SettlementsModule } from './settlements/settlements.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommentsModule } from './comments/comments.module';
import { InvitesModule } from './invites/invites.module';
import { EventsModule } from './common/events/events.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RealtimeModule } from './realtime/realtime.module';
import { FxModule } from './fx/fx.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RecurringModule } from './recurring/recurring.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { DataTransferModule } from './data-transfer/data-transfer.module';
import { AccountModule } from './account/account.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from './auth/guards/workspace-member.guard';
import { MetricsController } from './common/metrics.controller';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      controller: MetricsController,
      defaultMetrics: {
        enabled: true,
      },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60_000, limit: Number(config.get('THROTTLE_LIMIT') ?? 120) },
      ],
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ExpensesModule,
    BalancesModule,
    SettlementsModule,
    AnalyticsModule,
    CommentsModule,
    InvitesModule,
    EventsModule,
    IdempotencyModule,
    RealtimeModule,
    FxModule,
    PaymentsModule,
    NotificationsModule,
    RecurringModule,
    ReceiptsModule,
    BudgetsModule,
    CategoriesModule,
    DataTransferModule,
    AccountModule,
    CurrenciesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limit first so floods are rejected before any database work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Secure by default: authenticate every route, then check workspace membership.
    // Order matters: the JWT guard must populate request.user first.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: WorkspaceMemberGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Registered here (not in main.ts) so the integration tests run the same error handling.
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    makeHistogramProvider({
      name: HTTP_DURATION_METRIC,
      help: 'HTTP request duration in seconds, by route template',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, HttpMetricsMiddleware).forRoutes('*');
  }
}
