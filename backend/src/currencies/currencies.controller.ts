import { Controller, Get, Header } from '@nestjs/common';
import { Currency } from '../common/money/currency';

@Controller('api/v1')
export class CurrenciesController {
  /** Every supported ISO 4217 currency with its decimal places, so clients never guess them. */
  @Get('currencies')
  // The list only changes with a runtime upgrade.
  @Header('Cache-Control', 'private, max-age=86400')
  list() {
    return Currency.all().map(({ code, name, symbol, exponent }) => ({
      code,
      name,
      symbol,
      exponent,
    }));
  }
}
