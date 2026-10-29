import { Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators';
import { InvitesService } from './invites.service';

type AuthedRequest = { user: { id: string } };

@Controller('api/v1')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post('workspaces/:workspaceId/invites')
  @Roles('ADMIN')
  @HttpCode(201)
  create(@Param('workspaceId') workspaceId: string, @Req() req: AuthedRequest) {
    return this.invites.create(workspaceId, req.user.id);
  }

  @Delete('workspaces/:workspaceId/invites')
  @Roles('ADMIN')
  @HttpCode(204)
  revokeAll(@Param('workspaceId') workspaceId: string) {
    return this.invites.revokeAll(workspaceId);
  }

  @Get('invites/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  preview(@Param('token') token: string, @Req() req: AuthedRequest) {
    return this.invites.preview(token, req.user.id);
  }

  @Post('invites/:token/accept')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  accept(@Param('token') token: string, @Req() req: AuthedRequest) {
    return this.invites.accept(token, req.user.id);
  }
}
