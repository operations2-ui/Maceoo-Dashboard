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
    <div className="rounded-lg border border-slate-200 bg-white p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-700">Net Sales Trend</h3>
        <div className="flex rounded-md border border-slate-300 overflow-hidden text-xs">
          {(["daily", "monthly"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 capitalize ${
                granularity === g ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={compactMoney} />
            <Tooltip formatter={(v) => compactMoney(Number(v))} />
            <Line type="monotone" dataKey="netSales" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} name="Net Sales">
              {showLabels && (
                <LabelList
                  dataKey="netSales"
                  position="top"
                  formatter={(v) => compactMoney(Number(v))}
                  style={{ fontSize: 10, fill: "#475569" }}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
