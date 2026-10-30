/** One link in an error's `cause` chain, reduced to what helps diagnose it. */
export interface ErrorDetail {
  name: string;
  message: string;
  /** Postgres error code, e.g. 42703 = undefined column, 42P01 = undefined table. */
  code?: string;
  detail?: string;
  hint?: string;
  column?: string;
  table?: string;
}

/**
 * Drizzle wraps the database's own error in a "Failed query: ..." error whose message repeats the
 * SQL and the bound parameters (emails, ids). The wrapper is useless for diagnosis and the
 * parameters are personal data, so they are removed from anything we log.
 */
export const redactParams = (message: string): string => message.split('\nparams:')[0];

/** Walks `error.cause` so the underlying database error is not lost behind the wrapper. */
export function describeCauses(error: unknown, max = 4): ErrorDetail[] {
  const chain: ErrorDetail[] = [];
  let current: unknown = error;
  while (current instanceof Error && chain.length < max) {
    const e = current as Error & Record<string, unknown>;
    const text = (key: string) => (typeof e[key] === 'string' ? e[key] : undefined);
    chain.push({
      name: e.name,
      message: redactParams(e.message),
      code: text('code'),
      detail: text('detail'),
      hint: text('hint'),
      column: text('column_name') ?? text('column'),
      table: text('table_name') ?? text('table'),
    });
    current = e.cause;
  }
  return chain;
}
