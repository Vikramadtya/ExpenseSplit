import { useCurrencies } from './useCurrencies';

interface Props {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  /** Adds a first option with this label and the value "ALL" (for filters). */
  allLabel?: string;
  ariaLabel?: string;
}

/** A currency picker over every ISO 4217 currency, shown as "JPY – Japanese Yen". */
export function CurrencySelect({
  value,
  onChange,
  className,
  allLabel,
  ariaLabel = 'Currency',
}: Props) {
  const currencies = useCurrencies();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={className}
    >
      {allLabel && <option value="ALL">{allLabel}</option>}
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} – {c.name}
        </option>
      ))}
    </select>
  );
}
