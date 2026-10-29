import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { NotificationsService } from './notifications.service';
import { NudgesService } from './nudges.service';

export class NudgeDto extends createZodDto(z.object({ userId: z.string().uuid() })) {}
export class PushSubscriptionDto extends createZodDto(
  z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
) {}
export class UnsubscribeDto extends createZodDto(z.object({ endpoint: z.string().max(2000) })) {}

type Authed = { user: { id: string } };

@Controller('api/v1')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly nudges: NudgesService,
  ) {}

  @Get('notifications')
  list(@Req() req: Authed, @Query('limit') limit?: string) {
    return this.notifications.list(
      req.user.id,
      limit ? Number.parseInt(limit, 10) || undefined : undefined,
    );
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  readAll(@Req() req: Authed) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch('notifications/:id/read')
  @HttpCode(204)
  read(@Param('id', ParseUUIDPipe) id: string, @Req() req: Authed) {
    return this.notifications.markRead(req.user.id, id);
  }

  @Get('push/public-key')
  publicKey() {
    return this.notifications.pushPublicKey();
  }

  @Post('push/subscribe')
  @HttpCode(204)
  subscribe(@Body() dto: PushSubscriptionDto, @Req() req: Authed) {
    return this.notifications.subscribe(req.user.id, {
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    });
  }

  @Post('push/unsubscribe')
  @HttpCode(204)
  unsubscribe(@Body() dto: UnsubscribeDto, @Req() req: Authed) {
    return this.notifications.unsubscribe(req.user.id, dto.endpoint);
  }

  @Post('workspaces/:workspaceId/nudges')
  @HttpCode(200)
  nudge(@Param('workspaceId') workspaceId: string, @Body() dto: NudgeDto, @Req() req: Authed) {
    return this.nudges.nudge(workspaceId, req.user.id, dto.userId);
  }
}
