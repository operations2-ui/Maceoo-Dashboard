"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { compactMoney } from "@/lib/chart-format";

interface Row {
  order_date: string;
  net_sales: string | number | null;
  total_orders: number | null;
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function SalesTrendChart({ rows }: { rows: Row[] }) {
  const [granularity, setGranularity] = useState<"daily" | "monthly">("daily");

  const data = useMemo(() => {
    const map = new Map<string, { key: string; date: string; netSales: number; orders: number }>();
    for (const r of rows) {
      const key = granularity === "monthly" ? r.order_date.slice(0, 7) : r.order_date;
      if (!map.has(key)) {
        map.set(key, { key, date: granularity === "monthly" ? monthLabel(key) : key, netSales: 0, orders: 0 });
      }
      const entry = map.get(key)!;
      entry.netSales += Number(r.net_sales ?? 0);
      entry.orders += r.total_orders ?? 0;
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, granularity]);

  if (rows.length === 0) return null;

  // Value labels on every point get unreadable past a few dozen points (e.g. a
  // full year of daily data) — only show them when the chart is sparse enough.
  const showLabels = data.length <= 45;

  return (
    <div className="chart-surface rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Net Sales Trend</h3>
        <div className="flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
          {(["daily", "monthly"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 capitalize ${
                granularity === g
                  ? "bg-slate-900 dark:bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--chart-text)" }} />
            <YAxis tick={{ fontSize: 12, fill: "var(--chart-text)" }} tickFormatter={compactMoney} />
            <Tooltip
              formatter={(v) => compactMoney(Number(v))}
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--chart-grid)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="netSales"
              stroke="var(--chart-line)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Net Sales"
            >
              {showLabels && (
                <LabelList
                  dataKey="netSales"
                  position="top"
                  formatter={(v) => compactMoney(Number(v))}
                  style={{ fontSize: 10, fill: "var(--chart-text-strong)" }}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
