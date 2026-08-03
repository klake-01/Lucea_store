import React from 'react';

/**
 * Chart primitives for the dashboard.
 *
 * Inline SVG rather than a charting library: these are four simple shapes, and
 * a library would add far more to the admin bundle than the charts are worth.
 * Every chart is also given a text alternative, because a shape alone is not
 * data to a screen reader.
 */

const AMBRE = '#d98e4a';
const TERRA = '#b75b39';
const LINE = '#ddd4c4';
const PIERRE = '#6b6559';

export const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`bg-white border border-pierre-line rounded-2xl p-5 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-serif font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-[11px] text-pierre-deep mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

/** Revenue and order volume over the period. */
export const TrendChart: React.FC<{
  series: { date: string; orders: number; revenue_cents: number }[];
}> = ({ series }) => {
  if (!series.length) return <p className="text-xs text-pierre-deep">Pas encore de donnees.</p>;

  const W = 640;
  const H = 160;
  const PAD = 8;
  const max = Math.max(1, ...series.map((d) => d.revenue_cents));
  const step = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0;

  const points = series.map((d, i) => {
    const x = PAD + i * step;
    const y = H - PAD - ((d.revenue_cents / max) * (H - PAD * 2));
    return { x, y, ...d };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${H - PAD} L${points[0].x.toFixed(1)},${H - PAD} Z`;

  const totalRevenue = series.reduce((s, d) => s + d.revenue_cents, 0);
  const totalOrders = series.reduce((s, d) => s + d.orders, 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Evolution sur ${series.length} jours: ${totalOrders} commandes et ${(totalRevenue / 100).toFixed(0)} dirhams encaisses.`}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBRE} stopOpacity="0.28" />
            <stop offset="100%" stopColor={AMBRE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={PAD} x2={W - PAD} y1={PAD + (H - PAD * 2) * r} y2={PAD + (H - PAD * 2) * r}
                stroke={LINE} strokeWidth="1" strokeDasharray="3 3" />
        ))}

        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke={AMBRE} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p) => (
          p.revenue_cents > 0 ? (
            <circle key={p.date} cx={p.x} cy={p.y} r="2.5" fill={TERRA}>
              <title>{`${p.date}: ${(p.revenue_cents / 100).toFixed(2)} MAD, ${p.orders} commandes`}</title>
            </circle>
          ) : null
        ))}
      </svg>

      <figcaption className="mt-2 flex justify-between text-[11px] text-pierre-deep">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </figcaption>
    </figure>
  );
};

/** Horizontal bars, for cities, products and anything else ranked. */
export const BarList: React.FC<{
  items: { label: string; value: number; hint?: string }[];
  formatValue?: (v: number) => string;
  emptyLabel?: string;
}> = ({ items, formatValue = (v) => String(v), emptyLabel = 'Pas encore de donnees.' }) => {
  if (!items.length) return <p className="text-xs text-pierre-deep">{emptyLabel}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-ink truncate">{item.label}</span>
            <span className="text-ink font-semibold tabular-nums shrink-0">
              {formatValue(item.value)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 bg-ecru rounded-full overflow-hidden">
            <div
              className="h-full bg-ambre rounded-full"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          {item.hint && <p className="mt-1 text-[10px] text-pierre-deep">{item.hint}</p>}
        </li>
      ))}
    </ul>
  );
};

/** Order status split, as a donut. */
export const StatusDonut: React.FC<{
  data: { status: string; count: number }[];
  labels: Record<string, string>;
  colors: Record<string, string>;
}> = ({ data, labels, colors }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <p className="text-xs text-pierre-deep">Aucune commande.</p>;

  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox="0 0 140 140"
        className="w-32 h-32 shrink-0 -rotate-90"
        role="img"
        aria-label={`Repartition de ${total} commandes par statut.`}
      >
        {data.map((d) => {
          const portion = d.count / total;
          const dash = portion * C;
          const el = (
            <circle
              key={d.status}
              cx="70" cy="70" r={R}
              fill="none"
              stroke={colors[d.status] ?? PIERRE}
              strokeWidth="16"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${labels[d.status] ?? d.status}: ${d.count}`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </svg>

      <ul className="space-y-1.5 text-xs min-w-0">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: colors[d.status] ?? PIERRE }}
              aria-hidden="true"
            />
            <span className="text-ink-soft">{labels[d.status] ?? d.status}</span>
            <span className="text-ink font-semibold tabular-nums ml-auto pl-3">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Review rating spread, 5 down to 1. */
export const RatingBars: React.FC<{
  distribution: Record<string, number>;
  average: number;
}> = ({ distribution, average }) => {
  const total = Object.values(distribution).reduce((s, n) => s + n, 0);

  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-serif font-bold text-ink tabular-nums">
          {total ? average.toFixed(1).replace('.', ',') : '—'}
        </span>
        <span className="text-[11px] text-pierre-deep">
          sur {total} avis publie{total > 1 ? 's' : ''}
        </span>
      </p>

      <ul className="mt-3 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[String(star)] ?? 0;
          const pct = total ? (count / total) * 100 : 0;
          return (
            <li key={star} className="flex items-center gap-2.5 text-[11px]">
              <span className="w-3 text-pierre-deep tabular-nums">{star}</span>
              <span className="flex-1 h-1.5 bg-ecru rounded-full overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${pct}%`, background: star >= 4 ? AMBRE : TERRA }}
                />
              </span>
              <span className="w-6 text-right text-pierre-deep tabular-nums">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
