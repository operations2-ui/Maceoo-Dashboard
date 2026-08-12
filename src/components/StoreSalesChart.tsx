"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { compactMoney } from "@/lib/chart-format";

interface Row {
  store_name: string;
  net_sales: string | number | null;
  gross_margin: string | number | null;
}

export default function StoreSalesChart({ rows }: { rows: Row[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { store: string; netSales: number; grossMargin: number }>();
    for (const r of rows) {
      if (!map.has(r.store_name)) map.set(r.store_name, { store: r.store_name, netSales: 0, grossMargin: 0 });
      const entry = map.get(r.store_name)!;
      entry.netSales += Number(r.net_sales ?? 0);
      entry.grossMargin += Number(r.gross_margin ?? 0);
    }
    return [...map.values()].sort((a, b) => b.netSales - a.netSales);
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 mb-6">
      <h3 className="text-sm font-medium text-slate-700 mb-2">Sales &amp; Gross Margin by Store</h3>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="store" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={compactMoney} />
            <Tooltip formatter={(v) => compactMoney(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="netSales" name="Net Sales" fill="#0f172a" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="netSales" position="top" formatter={(v) => compactMoney(Number(v))} style={{ fontSize: 10, fill: "#475569" }} />
            </Bar>
            <Bar dataKey="grossMargin" name="Gross Margin" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="grossMargin" position="top" formatter={(v) => compactMoney(Number(v))} style={{ fontSize: 10, fill: "#475569" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
