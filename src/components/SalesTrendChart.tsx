"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function SalesTrendChart({
  data,
}: {
  data: { date: string; netSales: number; orders: number }[];
}) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 mb-6" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="netSales" stroke="#0f172a" strokeWidth={2} dot={false} name="Net Sales" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
