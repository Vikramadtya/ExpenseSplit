import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ReceiptsService } from './receipts.service';

@Controller('api/v1/workspaces/:workspaceId/receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  /** Raw image bytes in the body (Content-Type image/jpeg, image/png or image/webp). */
  @Post()
  @HttpCode(202)
  // Each scan costs money, so uploads are limited far below the general rate.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  upload(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.receipts.upload(workspaceId, req.user.id, req.body);
  }

  @Get(':receiptId')
  get(@Param('workspaceId') workspaceId: string, @Param('receiptId', ParseUUIDPipe) id: string) {
    return this.receipts.get(workspaceId, id);
  }

  @Get(':receiptId/image')
  async image(
    @Param('workspaceId') workspaceId: string,
    @Param('receiptId', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { mime, bytes } = await this.receipts.image(workspaceId, id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(bytes);
  }
}
