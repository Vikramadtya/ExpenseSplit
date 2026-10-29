import { Injectable } from '@nestjs/common';
import { FxRateProvider, LatestRates } from './fx.provider';

/** Free ECB-backed rates from frankfurter.dev, no API key needed. */
@Injectable()
export class FrankfurterProvider extends FxRateProvider {
  async fetchLatest(base: string): Promise<LatestRates> {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) throw new Error(`Frankfurter responded ${res.status}`);
    const body = (await res.json()) as LatestRates;
    return { date: body.date, rates: body.rates };
  }
}
