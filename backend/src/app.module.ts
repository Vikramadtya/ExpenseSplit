import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
