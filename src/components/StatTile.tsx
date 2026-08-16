import Link from "next/link";

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
  /** The comparison period's actual date range, e.g. "Jun 17 – Jul 16, 2026" — shown alongside the delta so "vs previous period" has a concrete meaning instead of being a vague label. */
  comparisonLabel?: string;
  href?: string;
  tone?: "default" | "critical" | "warning";
}

export default function StatTile({
  label,
  value,
  deltaPct,
  deltaGoodDirection = "up",
  comparisonLabel,
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
      <div className="mt-1.5">
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      </div>
      {deltaPct != null && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            isGoodDelta(deltaPct, deltaGoodDirection)
              ? "text-[var(--chart-status-good)]"
              : "text-[var(--chart-status-critical)]"
          }`}
        >
          {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%{" "}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            vs {comparisonLabel ?? "previous period"}
          </span>
        </p>
      )}
    </>
  );

  const className = `chart-surface block rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 h-full transition-all duration-200${
    href ? " hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md hover:-translate-y-0.5" : ""
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
