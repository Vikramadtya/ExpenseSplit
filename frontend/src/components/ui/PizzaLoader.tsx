/** A pizza that gets sliced and pulled apart, then comes back together. Styles live in index.html so the
 *  same animation also plays before the app has loaded (see `.pizza-*` there). */
const SLICES = 8;

export function PizzaLoader({
  label = 'Splitting the bill…',
  size = 112,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-text-muted"
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="pizza-spin" aria-hidden>
        {Array.from({ length: SLICES }, (_, i) => (
          <g
            key={i}
            className="pizza-slice"
            style={
              {
                '--r': `${(360 / SLICES) * i}deg`,
                animationDelay: `${i * 70}ms`,
              } as React.CSSProperties
            }
          >
            <path d="M50 50 L34.7 13 A40 40 0 0 1 65.3 13 Z" fill="#fbbf24" />
            <path
              d="M34.7 13 A40 40 0 0 1 65.3 13"
              fill="none"
              stroke="#b45309"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="50" cy="27" r="3.4" fill="#dc2626" />
            <circle cx="50" cy="40" r="2.2" fill="#dc2626" />
          </g>
        ))}
      </svg>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
