import type { DiscountBucketRow } from "@/lib/reports";

const money = (n: string | number | null) =>
  n == null
    ? "—"
    : `$${Math.abs(Number(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DiscountBucketsTable({ rows }: { rows: DiscountBucketRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No orders with gross sales in this period.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Discount %</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Orders</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Total Discounts</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Total Gross Sales</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Users</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bucket} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-900 dark:text-white">{r.bucket}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.orders.toLocaleString("en-US")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(r.total_discounts)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(r.total_gross_sales)}</td>
              <td
                className="px-3 py-2 max-w-[28rem] truncate text-slate-600 dark:text-slate-400"
                title={r.users.join(", ")}
              >
                {r.users.join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
