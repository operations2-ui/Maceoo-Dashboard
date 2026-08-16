"use client";

import { Fragment, useMemo, useState } from "react";
import type { RetailAuditDashboardRow, RetailAuditDetailRow } from "@/lib/reports";

interface Column {
  key: keyof RetailAuditDashboardRow;
  header: string;
  numeric?: boolean;
  danger?: boolean;
}

const columns: Column[] = [
  { key: "po_number", header: "PO Number" },
  { key: "po_date", header: "Date of PO" },
  { key: "po_status", header: "PO Status (From PO File)" },
  { key: "related_sp", header: "Related SP" },
  { key: "vendor_name", header: "Vendor Name" },
  { key: "ordered_quantity", header: "Ordered Quantity", numeric: true },
  { key: "billed_quantity", header: "Billed Quantity", numeric: true },
  { key: "shipped_quantity", header: "Shipped Quantity", numeric: true },
  { key: "received_quantity", header: "Received Quantity", numeric: true },
  { key: "diff_shipped_received", header: "Difference Between Shipped and Received", numeric: true, danger: true },
  { key: "diff_received_billed", header: "Difference Between Received and Billed", numeric: true, danger: true },
];

const detailColumns: { key: keyof RetailAuditDetailRow; header: string; numeric?: boolean }[] = [
  { key: "sku", header: "SKU" },
  { key: "item_name", header: "Item Name" },
  { key: "vendor", header: "Vendor" },
  { key: "po_date", header: "PO Date" },
  { key: "sp_number", header: "SP Number" },
  { key: "quantity_received", header: "Qty Received", numeric: true },
  { key: "quantity_billed", header: "Qty Billed", numeric: true },
  { key: "quantity_shipped", header: "Qty Shipped", numeric: true },
];

export default function RetailAuditTable({ rows }: { rows: RetailAuditDashboardRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: keyof RetailAuditDashboardRow; dir: "asc" | "desc" }>({
    key: "po_date",
    dir: "desc",
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, RetailAuditDetailRow[]>>({});
  const [loadingPo, setLoadingPo] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.po_number.toLowerCase().includes(q) ||
            (r.vendor_name ?? "").toLowerCase().includes(q) ||
            (r.related_sp ?? "").toLowerCase().includes(q),
        )
      : rows;

    const sorted = [...base].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let cmp: number;
      if (columns.find((c) => c.key === sort.key)?.numeric) {
        cmp = (Number(av) || 0) - (Number(bv) || 0);
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, sort]);

  function toggleSort(key: keyof RetailAuditDashboardRow) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function toggleRow(poNumber: string) {
    if (expanded === poNumber) {
      setExpanded(null);
      return;
    }
    setExpanded(poNumber);
    setDetailError(null);
    if (!detailCache[poNumber]) {
      setLoadingPo(poNumber);
      try {
        const res = await fetch(`/api/retail-audit/detail?po=${encodeURIComponent(poNumber)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load PO detail");
        setDetailCache((prev) => ({ ...prev, [poNumber]: data.rows ?? [] }));
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingPo(null);
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PO number, vendor, or SP..."
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-72"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
          {filtered.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} POs
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No purchase orders found.
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
                    className={`px-3 py-2 text-left font-semibold text-white whitespace-nowrap cursor-pointer select-none ${
                      c.danger ? "bg-red-800 hover:bg-red-700" : "bg-emerald-800 hover:bg-emerald-700"
                    }`}
                  >
                    {c.header}
                    <span className="ml-1 text-xs opacity-70">
                      {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "▽"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.po_number}>
                  <tr
                    onClick={() => toggleRow(r.po_number)}
                    className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors ${
                      expanded === r.po_number
                        ? "bg-blue-50 dark:bg-slate-800"
                        : "odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800"
                    }`}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-2 whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : "text-left"} ${
                          c.key === "po_number" ? "font-medium text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {String(r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                  {expanded === r.po_number && (
                    <tr>
                      <td colSpan={columns.length} className="p-0 bg-slate-100 dark:bg-slate-950">
                        <div className="p-3">
                          {loadingPo === r.po_number && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 px-2 py-3">Loading SKU detail…</p>
                          )}
                          {detailError && loadingPo !== r.po_number && (
                            <p className="text-sm text-red-600 dark:text-red-400 px-2 py-3">{detailError}</p>
                          )}
                          {detailCache[r.po_number] && (
                            <table className="w-full text-sm border-collapse bg-white dark:bg-slate-900 rounded-md overflow-hidden">
                              <thead>
                                <tr className="bg-slate-200 dark:bg-slate-800">
                                  {detailColumns.map((dc) => (
                                    <th
                                      key={dc.key}
                                      className={`px-3 py-1.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap ${
                                        dc.numeric ? "text-right" : "text-left"
                                      }`}
                                    >
                                      {dc.header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {detailCache[r.po_number].length === 0 ? (
                                  <tr>
                                    <td colSpan={detailColumns.length} className="px-3 py-3 text-center text-slate-500 dark:text-slate-400">
                                      No SKU-level rows found for this PO.
                                    </td>
                                  </tr>
                                ) : (
                                  detailCache[r.po_number].map((d, i) => (
                                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                                      {detailColumns.map((dc) => (
                                        <td
                                          key={dc.key}
                                          className={`px-3 py-1.5 whitespace-nowrap ${
                                            dc.numeric ? "text-right tabular-nums" : "text-left"
                                          } text-slate-700 dark:text-slate-300`}
                                        >
                                          {String(d[dc.key] ?? "—")}
                                        </td>
                                      ))}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
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
