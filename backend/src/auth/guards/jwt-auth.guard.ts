import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (this.configService.get<string>('BYPASS_GOOGLE_OAUTH') === 'true') {
      const request = context.switchToHttp().getRequest();
      request.user = { id: 'dev-user-id', email: 'dev@expensesplit.com' };
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (this.configService.get<string>('BYPASS_GOOGLE_OAUTH') === 'true' && !user) {
      return { id: 'dev-user-id', email: 'dev@expensesplit.com' };
    }
    if (err || !user) {
      throw err || new UnauthorizedException('Missing or invalid authentication token');
    }
    return user;
  }
}
