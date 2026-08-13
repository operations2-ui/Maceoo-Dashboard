"use client";

import { Fragment, useMemo, useState } from "react";
import type { MissingSizeRow } from "@/lib/reports";

function ExpandedDetail({ row }: { row: MissingSizeRow }) {
  type DetailRow = { size: string; sku: string | null; description: string | null; onHand: number | null; missing: boolean };

  const detail: DetailRow[] = useMemo(() => {
    const byPresent: DetailRow[] = row.variants
      .filter((v) => /^[0-9]+$/.test(v.size_code))
      .map((v) => ({ size: v.size_code, sku: v.sku, description: v.description, onHand: v.on_hand, missing: false }));
    const missing: DetailRow[] = (row.missing_sizes ?? []).map((s) => ({
      size: s,
      sku: null,
      description: null,
      onHand: null,
      missing: true,
    }));
    return [...byPresent, ...missing].sort((a, b) => Number(a.size) - Number(b.size));
  }, [row]);

  return (
    <tr>
      <td colSpan={5} className="bg-slate-50 dark:bg-slate-800 px-4 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="pr-4 py-1 font-medium">Size</th>
              <th className="pr-4 py-1 font-medium">SKU</th>
              <th className="pr-4 py-1 font-medium">Description</th>
              <th className="pr-4 py-1 font-medium text-right">On Hand</th>
            </tr>
          </thead>
          <tbody>
            {detail.map((d) => (
              <tr key={d.size} className={d.missing ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}>
                <td className="pr-4 py-1 font-medium">{d.size}</td>
                <td className="pr-4 py-1">{d.missing ? "— no SKU on file —" : d.sku}</td>
                <td className="pr-4 py-1">{d.missing ? "—" : d.description}</td>
                <td className="pr-4 py-1 text-right tabular-nums">{d.missing ? "—" : d.onHand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

export default function MissingSizesTable({ rows }: { rows: MissingSizeRow[] }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.style_code.toLowerCase().includes(q) ||
        r.present_sizes.join(",").includes(q) ||
        (r.missing_sizes ?? []).join(",").includes(q),
    );
  }, [rows, search]);

  function toggle(styleCode: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(styleCode)) next.delete(styleCode);
      else next.add(styleCode);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search style or size..."
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-56"
          />
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
          {search ? `${filteredRows.length.toLocaleString("en-US")} of ${rows.length.toLocaleString("en-US")}` : rows.length.toLocaleString("en-US")}{" "}
          rows
        </span>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No missing-size gaps for this store and date.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-auto max-h-[70vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap w-8"></th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                  Style
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                  Min Size
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                  Max Size
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                  Missing Sizes
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <Fragment key={r.style_code}>
                  <tr
                    onClick={() => toggle(r.style_code)}
                    className="border-b border-slate-100 dark:border-slate-800 odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 text-slate-400 dark:text-slate-500">
                      {expanded.has(r.style_code) ? "▼" : "▶"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                      {r.style_code}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.min_size}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.max_size}</td>
                    <td className="px-3 py-2 text-red-600 dark:text-red-400 font-semibold">
                      {(r.missing_sizes ?? []).join(", ")}
                    </td>
                  </tr>
                  {expanded.has(r.style_code) && <ExpandedDetail row={r} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
