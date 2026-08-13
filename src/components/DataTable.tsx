export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Extra classes for this cell, e.g. red text when a value is negative. */
  cellClassName?: (row: T) => string;
  /** Ellipsis-truncate long text (e.g. descriptions) with a hover tooltip. */
  truncate?: boolean;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = "No results.",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-auto max-h-[70vh]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800 ${
                  c.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors"
            >
              {columns.map((c) => {
                const rawValue = row[c.key];
                const extra = c.cellClassName ? c.cellClassName(row) : "";
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : "text-left"} ${
                      c.truncate ? "max-w-[22rem] truncate" : "whitespace-nowrap"
                    } ${extra}`}
                    title={c.truncate && typeof rawValue === "string" ? rawValue : undefined}
                  >
                    {c.render ? c.render(row) : String(rawValue ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
