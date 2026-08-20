"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BuyPlanStoreRow } from "@/lib/reports";

interface Column {
  key: keyof BuyPlanStoreRow;
  header: string;
  title?: string;
  numeric?: boolean;
}

const columns: Column[] = [
  { key: "store_name", header: "Store" },
  { key: "wtd", header: "WTD Sold", numeric: true },
  { key: "last_7d", header: "Last 7 Days Sold", numeric: true },
  { key: "mtd", header: "MTD Sold", numeric: true },
  { key: "last_3mo", header: "Last 3 Mths Sold", numeric: true },
  { key: "ytd", header: "YTD Sold", numeric: true },
  { key: "all_time", header: "All-Time Sold", numeric: true },
  { key: "insufficient_count", header: "Insufficient Stock", title: "Items selling fast with under 14 days of supply", numeric: true },
  { key: "idle_count", header: "Idle Items", title: "Items in stock with no sales in the last 90 days", numeric: true },
];

export default function BuyPlanStoreTable({ rows }: { rows: BuyPlanStoreRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: keyof BuyPlanStoreRow; dir: "asc" | "desc" }>({
    key: "all_time",
    dir: "desc",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.store_name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = columns.find((c) => c.key === sort.key)?.numeric
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  // Recomputed from whatever's currently visible, so it tracks the search box.
  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const c of columns) {
      if (!c.numeric) continue;
      sums[c.key] = filtered.reduce((sum, r) => sum + Number(r[c.key] ?? 0), 0);
    }
    return sums;
  }, [filtered]);

  function toggleSort(key: keyof BuyPlanStoreRow) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No stores to show.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search store..."
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-64"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
          {filtered.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} stores
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No stores match.
        </div>
      ) : (
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
                    {c.header}
                    <span className="ml-0.5 text-xs opacity-60">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "▽"}</span>
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b-2 border-slate-300 dark:border-slate-700">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 font-semibold whitespace-nowrap ${
                      c.numeric ? "text-right tabular-nums text-slate-800 dark:text-slate-200" : "text-left text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {c.key === "store_name" ? "Total" : totals[c.key].toLocaleString("en-US")}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.store_id}
                  onClick={() => router.push(`/buy-plan/${r.store_id}`)}
                  className="cursor-pointer border-b border-slate-100 dark:border-slate-800 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors"
                >
                  {columns.map((c) => {
                    const value = r[c.key];
                    const isAlert = (c.key === "insufficient_count" || c.key === "idle_count") && Number(value) > 0;
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-2 whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : "text-left"} ${
                          c.key === "store_name"
                            ? "font-medium text-blue-700 dark:text-blue-400"
                            : isAlert
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {c.key === "store_name" ? String(value) : Number(value).toLocaleString("en-US")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
