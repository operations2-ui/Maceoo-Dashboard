"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BuyPlanGroupRow } from "@/lib/reports";

interface Column {
  key: keyof BuyPlanGroupRow;
  header: string;
  title?: string;
  numeric?: boolean;
}

const columns: Column[] = [
  { key: "label", header: "Name" },
  { key: "wtd", header: "WTD Sold", numeric: true },
  { key: "last_7d", header: "Last 7 Days Sold", numeric: true },
  { key: "mtd", header: "MTD Sold", numeric: true },
  { key: "last_3mo", header: "Last 3 Mths Sold", numeric: true },
  { key: "ytd", header: "YTD Sold", numeric: true },
  { key: "all_time", header: "All-Time Sold", numeric: true },
  { key: "on_hand", header: "On Hand", numeric: true },
  { key: "insufficient_count", header: "Insufficient Stock", title: "Items selling fast with under 14 days of supply", numeric: true },
  { key: "idle_count", header: "Idle Items", title: "Items in stock with no sales in the last 90 days", numeric: true },
];

/**
 * Reusable sortable list for the Category and Style levels of the Buy Plan
 * drill-down (Store -> Category -> Style -> Size) — same shape as
 * BuyPlanStoreTable, generalized to whatever grouping the caller's rows
 * represent, with an on_hand column since these are cross-item totals.
 * `href` is precomputed server-side and attached to each row — a function
 * prop can't cross the Server -> Client Component boundary.
 */
export default function BuyPlanGroupTable({
  rows,
  nameHeader,
}: {
  rows: (BuyPlanGroupRow & { href: string })[];
  /** Header label for the first column, e.g. "Category" or "Style". */
  nameHeader: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: keyof BuyPlanGroupRow; dir: "asc" | "desc" }>({
    key: "all_time",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = columns.find((c) => c.key === sort.key)?.numeric
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  function toggleSort(key: keyof BuyPlanGroupRow) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Nothing to show.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-auto max-h-[75vh]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                title={c.title}
                className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                {c.key === "label" ? nameHeader : c.header}
                <span className="ml-0.5 text-xs opacity-60">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "▽"}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.group_key}
              onClick={() => router.push(r.href)}
              className="cursor-pointer border-b border-slate-100 dark:border-slate-800 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors"
            >
              {columns.map((c) => {
                const value = r[c.key];
                const isAlert = (c.key === "insufficient_count" || c.key === "idle_count") && Number(value) > 0;
                return (
                  <td
                    key={c.key}
                    title={c.key === "label" ? String(value) : undefined}
                    className={`px-3 py-2 ${c.key === "label" ? "truncate max-w-[24rem]" : "whitespace-nowrap"} ${
                      c.numeric ? "text-right tabular-nums" : "text-left"
                    } ${
                      c.key === "label"
                        ? "font-medium text-blue-700 dark:text-blue-400"
                        : isAlert
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {c.key === "label" ? String(value) : Number(value).toLocaleString("en-US")}
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
