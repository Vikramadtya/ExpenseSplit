export interface LatestRates {
  /** Date the rates are quoted for (ISO yyyy-mm-dd). */
  date: string;
  rates: Record<string, number>;
}

/** Source of exchange rates. Swap the implementation to change vendor. */
export abstract class FxRateProvider {
  abstract fetchLatest(base: string): Promise<LatestRates>;
}
