import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { FxRateProvider } from './fx.provider';
import { FxRepository } from './fx.repository';

const FRESH_FOR_MS = 12 * 60 * 60 * 1000;
const CURRENCY = /^[A-Za-z]{3}$/;

@Injectable()
export class FxService {
  constructor(
    private readonly repository: FxRepository,
    private readonly provider: FxRateProvider,
  ) {}

  async getRates(baseInput: string) {
    if (!CURRENCY.test(baseInput)) throw new BadRequestException('Invalid currency code');
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

  /** Converts minor units from one currency to another at the latest rate. */
  async convertMinor(minor: number, from: string, to: string): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase() || minor === 0) return minor;
    const { rates } = await this.getRates(from);
    const rate = rates[to.toUpperCase()];
    if (!rate) throw new BadRequestException(`No exchange rate from ${from} to ${to}`);
    return Math.round(minor * rate);
  }

  private format(base: string, rows: { quote: string; rate: string; rateDate: string }[]) {
    return {
      base,
      date: rows[0].rateDate,
      rates: Object.fromEntries(rows.map((r) => [r.quote, Number(r.rate)])),
    };
  }
}
