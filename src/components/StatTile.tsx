import Link from "next/link";

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 72;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="var(--chart-line)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isGoodDelta(deltaPct: number, dir: "up" | "down"): boolean {
  return dir === "up" ? deltaPct >= 0 : deltaPct <= 0;
}

interface StatTileProps {
  label: string;
  value: string;
  /** Percent change vs the previous equal-length period, e.g. 12.4 or -3.1. */
  deltaPct?: number | null;
  /** Whether an increase counts as good news (default) or bad (e.g. a cost metric). */
  deltaGoodDirection?: "up" | "down";
  sparkline?: number[];
  href?: string;
  tone?: "default" | "critical" | "warning";
}

export default function StatTile({
  label,
  value,
  deltaPct,
  deltaGoodDirection = "up",
  sparkline,
  href,
  tone = "default",
}: StatTileProps) {
  const toneClass =
    tone === "critical"
      ? "text-[var(--chart-status-critical)]"
      : tone === "warning"
        ? "text-[var(--chart-status-warning)]"
        : "text-slate-900 dark:text-white";

  const inner = (
    <>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
      </div>
      {deltaPct != null && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            isGoodDelta(deltaPct, deltaGoodDirection)
              ? "text-[var(--chart-status-good)]"
              : "text-[var(--chart-status-critical)]"
          }`}
        >
          {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}% vs previous period
        </p>
      )}
    </>
  );

  const className = `chart-surface block rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 h-full${
    href ? " hover:border-slate-400 dark:hover:border-slate-600 transition-colors" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
