import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Currency, Money } from '../common/money/money';
import { FxRateProvider } from './fx.provider';
import { FxRepository } from './fx.repository';

const FRESH_FOR_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class FxService {
  constructor(
    private readonly repository: FxRepository,
    private readonly provider: FxRateProvider,
  ) {}

  async getRates(baseInput: string) {
    if (!Currency.isValid(baseInput)) throw new BadRequestException('Unknown currency code');
    const base = baseInput.toUpperCase();

    const cached = await this.repository.findByBase(base);
    const oldest = cached.reduce((min, r) => Math.min(min, r.fetchedAt.getTime()), Infinity);
    if (cached.length > 0 && Date.now() - oldest < FRESH_FOR_MS) return this.format(base, cached);

    try {
      const latest = await this.provider.fetchLatest(base);
      await this.repository.replace(base, latest.date, latest.rates);
      return { base, date: latest.date, rates: latest.rates };
    } catch {
      // The provider is down: slightly old rates beat no conversion at all.
      if (cached.length > 0) return this.format(base, cached);
      throw new ServiceUnavailableException('Exchange rates are unavailable right now');
    }
  }

  /** Converts an amount to another currency at the latest rate, to a whole minor unit of the target. */
  async convert(amount: Money, to: string): Promise<Money> {
    const target = Currency.of(to).code;
    if (amount.currency === target || amount.isZero())
      return amount.currency === target ? amount : Money.zero(target);
    const { rates } = await this.getRates(amount.currency);
    const rate = rates[target];
    if (!rate)
      throw new BadRequestException(`No exchange rate from ${amount.currency} to ${target}`);
    return amount.convertTo(target, rate);
  }

  private format(base: string, rows: { quote: string; rate: string; rateDate: string }[]) {
    return {
      base,
      date: rows[0].rateDate,
      rates: Object.fromEntries(rows.map((r) => [r.quote, Number(r.rate)])),
    };
  }
}
