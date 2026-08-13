interface LeagueRow {
  rank: number;
  label: string;
  value: string;
}

export default function LeagueTable({ title, rows }: { title: string; rows: LeagueRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="chart-surface rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{title}</h3>
      <ol>
        {rows.map((r) => (
          <li
            key={r.rank}
            className="flex items-center gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
          >
            <span className="w-5 text-xs text-slate-400 dark:text-slate-500 tabular-nums">{r.rank}</span>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              style={{ background: "var(--chart-bar)" }}
            >
              {r.label.slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{r.label}</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
