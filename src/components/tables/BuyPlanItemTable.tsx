"use client";

import { Fragment, useMemo, useState } from "react";
import type { BuyPlanItemRow, BuyPlanTransferSuggestion } from "@/lib/reports";

interface Column {
  key: keyof BuyPlanItemRow;
  header: string;
  title?: string;
  numeric?: boolean;
  width?: string;
}

const columns: Column[] = [
  { key: "core_sku", header: "Style", width: "w-28" },
  { key: "description", header: "Description", width: "w-56" },
  { key: "size_code", header: "Size", width: "w-14" },
  { key: "wtd", header: "WTD", title: "Week to Date Sold", numeric: true, width: "w-14" },
  { key: "last_7d", header: "7 Days", title: "Last 7 Days Sold", numeric: true, width: "w-16" },
  { key: "mtd", header: "MTD", title: "Month to Date Sold", numeric: true, width: "w-14" },
  { key: "last_3mo", header: "3 Mths", title: "Last 3 Months Sold", numeric: true, width: "w-16" },
  { key: "ytd", header: "YTD", title: "Year to Date Sold", numeric: true, width: "w-14" },
  { key: "all_time", header: "All-Time", numeric: true, width: "w-20" },
  { key: "on_hand", header: "On Hand", numeric: true, width: "w-20" },
  { key: "days_of_supply", header: "Days Supply", numeric: true, width: "w-24" },
  { key: "status", header: "Status", width: "w-28" },
];

type StatusFilter = "attention" | "insufficient" | "idle" | "all";

const statusBadge: Record<string, string> = {
  insufficient: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  idle: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  ok: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function BuyPlanItemTable({ rows, storeId }: { rows: BuyPlanItemRow[]; storeId: string }) {
  const [search, setSearch] = useState("");
  // Now reached by drilling down to one style, so rows are naturally few —
  // default to showing all sizes rather than hiding "ok" ones as before,
  // when this table listed every item in the store flat.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<{ key: keyof BuyPlanItemRow; dir: "asc" | "desc" }>({
    key: "all_time",
    dir: "desc",
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [suggestionCache, setSuggestionCache] = useState<Record<string, BuyPlanTransferSuggestion[]>>({});
  const [loadingSku, setLoadingSku] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = rows;
    if (statusFilter === "attention") base = base.filter((r) => r.status !== "ok");
    else if (statusFilter !== "all") base = base.filter((r) => r.status === statusFilter);
    if (q) {
      base = base.filter(
        (r) =>
          r.variant_sku.toLowerCase().includes(q) ||
          r.core_sku.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...base].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = columns.find((c) => c.key === sort.key)?.numeric
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, statusFilter, sort]);

  function toggleSort(key: keyof BuyPlanItemRow) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function toggleRow(r: BuyPlanItemRow) {
    if (r.status !== "insufficient") return;
    if (expanded === r.variant_sku) {
      setExpanded(null);
      return;
    }
    setExpanded(r.variant_sku);
    setSuggestionError(null);
    if (!suggestionCache[r.variant_sku]) {
      setLoadingSku(r.variant_sku);
      try {
        const res = await fetch(
          `/api/buy-plan/transfer-suggestions?variantSku=${encodeURIComponent(r.variant_sku)}&storeId=${storeId}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load transfer suggestions");
        setSuggestionCache((prev) => ({ ...prev, [r.variant_sku]: data.rows ?? [] }));
      } catch (e) {
        setSuggestionError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingSku(null);
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search style, SKU, or description..."
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
        >
          <option value="attention">Needs Attention (Insufficient + Idle)</option>
          <option value="insufficient">Insufficient Only</option>
          <option value="idle">Idle Only</option>
          <option value="all">All Items</option>
        </select>
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
          {filtered.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} items
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No items match.
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
                    className={`${c.numeric ? "px-1.5" : "px-3"} py-2 text-left font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 ${c.width ?? ""} ${c.numeric ? "leading-tight" : "whitespace-nowrap"}`}
                  >
                    {c.header}
                    <span className="ml-0.5 text-xs opacity-60">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "▽"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.variant_sku}>
                  <tr
                    onClick={() => toggleRow(r)}
                    className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${
                      r.status === "insufficient" ? "cursor-pointer" : ""
                    } ${
                      expanded === r.variant_sku
                        ? "bg-blue-50 dark:bg-slate-800"
                        : "odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800"
                    }`}
                  >
                    {columns.map((c) => {
                      if (c.key === "status") {
                        return (
                          <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusBadge[r.status]}`}>
                              {r.status === "insufficient" ? "Insufficient" : r.status === "idle" ? "Idle" : "OK"}
                            </span>
                          </td>
                        );
                      }
                      const value = r[c.key];
                      return (
                        <td
                          key={c.key}
                          title={c.key === "description" ? String(value ?? "") : undefined}
                          className={`${c.numeric ? "px-1.5" : "px-3"} py-2 ${
                            c.key === "description" ? "truncate max-w-[14rem]" : "whitespace-nowrap"
                          } ${c.numeric ? "text-right tabular-nums" : "text-left"} text-slate-700 dark:text-slate-300`}
                        >
                          {value === null || value === undefined ? "—" : c.numeric ? Number(value).toLocaleString("en-US") : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                  {expanded === r.variant_sku && (
                    <tr>
                      <td colSpan={columns.length} className="p-0 bg-slate-100 dark:bg-slate-950">
                        <div className="p-3">
                          {loadingSku === r.variant_sku && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 px-2 py-3">
                              Looking for stores with spare stock…
                            </p>
                          )}
                          {suggestionError && loadingSku !== r.variant_sku && (
                            <p className="text-sm text-red-600 dark:text-red-400 px-2 py-3">{suggestionError}</p>
                          )}
                          {suggestionCache[r.variant_sku] && (
                            <div className="rounded-md overflow-hidden">
                              {suggestionCache[r.variant_sku].length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 px-2 py-3">
                                  No other store currently has spare stock of this item.
                                </p>
                              ) : (
                                <table className="w-full text-sm border-collapse bg-white dark:bg-slate-900">
                                  <thead>
                                    <tr className="bg-slate-200 dark:bg-slate-800">
                                      <th className="px-3 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">
                                        Transfer From
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-slate-600 dark:text-slate-300">
                                        On Hand
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-slate-600 dark:text-slate-300">
                                        Their 30-Day Sales
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-slate-600 dark:text-slate-300">
                                        Spare To Transfer
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {suggestionCache[r.variant_sku].map((s) => (
                                      <tr key={s.store_id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300">{s.store_name}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                          {s.on_hand.toLocaleString("en-US")}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                          {s.last_30d.toLocaleString("en-US")}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                                          {s.spare.toLocaleString("en-US")}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
