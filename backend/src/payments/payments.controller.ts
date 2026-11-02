import { Controller, Get, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { currencyCode } from '../common/money/currency-code.schema';

import { PaymentsService } from './payments.service';

export class PaymentLinksQueryDto extends createZodDto(
  z.object({
    payeeId: z.string().uuid(),
    amount: z.coerce.number().positive().max(9_999_999_999),
    currency: currencyCode,
    note: z.string().max(100).default('ExpenseSplit settle up'),
  }),
) {}

@Controller('api/v1')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payment-links')
  links(@Query() q: PaymentLinksQueryDto, @Req() req: { user: { id: string } }) {
    return this.payments.linksFor(req.user.id, q.payeeId, q.amount, q.currency, q.note);
  }
}
