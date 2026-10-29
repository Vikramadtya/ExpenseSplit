import { Body, Controller, Delete, Get, HttpCode, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import type { Response } from 'express';
import { z } from 'zod';
import { AccountService } from './account.service';

export class DeleteAccountDto extends createZodDto(z.object({ confirm: z.literal('DELETE') })) {}

type Authed = { user: { id: string } };

@Controller('api/v1/users/me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** A copy of your data as a JSON download. */
  @Get('export')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  async export(@Req() req: Authed, @Res() res: Response) {
    const data = await this.account.exportData(req.user.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="expensesplit-my-data.json"');
    res.send(JSON.stringify(data, null, 2));
  }

  /** Permanently deletes your account. Body must be {"confirm":"DELETE"}. */
  @Delete()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  delete(@Req() req: Authed, @Body() _dto: DeleteAccountDto) {
    return this.account.deleteAccount(req.user.id);
  }
}
