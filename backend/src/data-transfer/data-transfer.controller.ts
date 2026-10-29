import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { Roles } from '../auth/decorators';
import { DataTransferService } from './data-transfer.service';

const mappingSchema = z.record(z.string().max(200), z.string().uuid());
const isoDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
  return date;
};

@Controller('api/v1/workspaces/:workspaceId')
export class DataTransferController {
  constructor(private readonly transfer: DataTransferService) {}

  @Get('export.csv')
  async export(
    @Param('workspaceId') workspaceId: string,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.transfer.exportCsv(workspaceId, isoDate(from), isoDate(to));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(`\uFEFF${csv}`); // BOM so Excel reads the UTF-8 names correctly
  }

  /**
   * Imports a Splitwise CSV export (send it as the request body with Content-Type: text/csv).
   * `dryRun=true` reports what would happen without saving. Rows already in the workspace are skipped.
   */
  @Post('import/splitwise')
  @Roles('ADMIN')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  importSplitwise(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() req: { user: { id: string } },
    @Query('dryRun') dryRun?: string,
    @Query('mapping') mapping?: string,
  ) {
    if (typeof body !== 'string' || body.length === 0) {
      throw new UnsupportedMediaTypeException(
        'Send the CSV as the request body with Content-Type: text/csv',
      );
    }
    let parsedMapping: Record<string, string> | undefined;
    if (mapping) {
      try {
        parsedMapping = mappingSchema.parse(JSON.parse(mapping));
      } catch {
        throw new BadRequestException('mapping must be a JSON object of name -> member id');
      }
    }
    return this.transfer.importSplitwise(workspaceId, req.user.id, body, {
      dryRun: dryRun === 'true',
      mapping: parsedMapping,
    });
  }
}
