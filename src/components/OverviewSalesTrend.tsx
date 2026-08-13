"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { compactMoney } from "@/lib/chart-format";

interface Row {
  date: string;
  value: number;
}

export default function OverviewSalesTrend({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="chart-surface rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Net Sales Trend</h3>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--chart-text)" }}
              axisLine={{ stroke: "var(--chart-baseline)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--chart-text)" }}
              tickFormatter={compactMoney}
              axisLine={false}
              tickLine={false}
              width={56}
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
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart-line)"
              strokeWidth={2}
              fill="var(--chart-line-fill)"
              name="Net Sales"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
