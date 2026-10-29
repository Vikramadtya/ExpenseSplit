import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators';

const DEV_USER = { id: 'dev-user-id', email: 'dev@expensesplit.com' };

/** Registered globally: every route requires a valid JWT unless marked `@Public()`. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    if (this.devBypassEnabled) {
      context.switchToHttp().getRequest().user = DEV_USER;
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('Missing or invalid token');
    }
    return user;
  }

  /** The bypass can never be switched on in production, whatever the env says. */
  private get devBypassEnabled() {
    return (
      this.configService.get<string>('BYPASS_GOOGLE_OAUTH') === 'true' &&
      this.configService.get<string>('NODE_ENV') !== 'production'
    );
  }
}
