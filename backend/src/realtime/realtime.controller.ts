import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { EventBus } from '../common/events/event-bus';

const HEARTBEAT_MS = 25_000;

@Controller('api/v1')
export class RealtimeController {
  constructor(private readonly events: EventBus) {}

  /**
   * Server-sent events for one workspace. Membership is enforced by the global guard, and
   * events carry ids only, so clients refetch through the normal authorized endpoints.
   */
  @Get('workspaces/:workspaceId/events')
  @SkipThrottle()
  stream(@Param('workspaceId') workspaceId: string, @Req() req: Request, @Res() res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // don't let proxies buffer the stream
    });
    res.write('retry: 3000\n\n');

    const unsubscribe = this.events.subscribe(workspaceId, (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}
