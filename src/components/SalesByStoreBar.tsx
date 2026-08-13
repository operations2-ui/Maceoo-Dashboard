"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { compactMoney } from "@/lib/chart-format";

interface Row {
  store: string;
  value: number;
}

/**
 * Ranks one measure (net sales) across stores. Deliberately a single
 * sequential hue rather than a different color per store — the stores
 * aren't a categorical "identity" story here, the ranking/magnitude is.
 */
export default function SalesByStoreBar({ rows }: { rows: Row[] }) {
  const data = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows]);
  if (data.length === 0) return null;

  const height = Math.max(160, data.length * 34 + 24);

  return (
    <div className="chart-surface rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Sales by Store</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--chart-text)" }}
              tickFormatter={compactMoney}
              axisLine={{ stroke: "var(--chart-baseline)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="store"
              width={110}
              tick={{ fontSize: 12, fill: "var(--chart-text)" }}
              axisLine={{ stroke: "var(--chart-baseline)" }}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => compactMoney(Number(v))}
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--chart-grid)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="var(--chart-bar)" radius={[0, 4, 4, 0]} maxBarSize={20} name="Net Sales">
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => compactMoney(Number(v))}
                style={{ fontSize: 11, fill: "var(--chart-text-strong)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
