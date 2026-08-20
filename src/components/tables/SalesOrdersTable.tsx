"use client";

import FilterableTable from "@/components/FilterableTable";
import type { SalesOrderRow } from "@/lib/reports";

const money = (n: string | number | null) =>
  n == null
    ? "—"
    : `${Number(n) < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

// Store/User/Discount% aren't filterable here anymore — the single search
// box above the tabs (in DiscountsAnalysisTabs) is the only filter on this
// page, on top of the page-level Store/Date filter.
export default function SalesOrdersTable({ rows, search }: { rows: SalesOrderRow[]; search: string }) {
  return (
    <FilterableTable
      rows={rows}
      searchKeys={["order_name", "user_name", "store_name"]}
      search={search}
      hideControls
      emptyMessage="No orders found for this filter."
      totals={(visible) => {
        const gross = visible.reduce((s, r) => s + (Number(r.gross_sales) || 0), 0);
        const discounts = visible.reduce((s, r) => s + (Number(r.discounts) || 0), 0);
        const refunds = visible.reduce((s, r) => s + (Number(r.refunds) || 0), 0);
        const net = visible.reduce((s, r) => s + (Number(r.net_sales) || 0), 0);
        return {
          day_date: `Total (${visible.length.toLocaleString("en-US")} orders)`,
          gross_sales: money(gross),
          discounts: money(discounts),
          refunds: money(refunds),
          net_sales: money(net),
          discount_pct: gross > 0 ? `${((discounts / gross) * 100).toFixed(1)}%` : "—",
        };
      }}
      columns={[
        { key: "day_date", header: "Date" },
        { key: "store_name", header: "Store" },
        { key: "order_name", header: "Order" },
        { key: "user_name", header: "User", truncate: true },
        { key: "gross_sales", header: "Gross Sales", align: "right", render: (r) => money(r.gross_sales) },
        { key: "discounts", header: "Discounts", align: "right", render: (r) => money(r.discounts) },
        { key: "refunds", header: "Refunds", align: "right", render: (r) => money(r.refunds) },
        {
          key: "net_sales",
          header: "Net Sales",
          align: "right",
          render: (r) => money(r.net_sales),
          cellClassName: (r) => (Number(r.net_sales) < 0 ? "text-red-600 dark:text-red-400" : ""),
        },
        {
          key: "discount_pct",
          header: "Discount %",
          align: "right",
          render: (r) => (r.discount_pct == null ? "—" : `${Number(r.discount_pct).toFixed(1)}%`),
          cellClassName: (r) =>
            r.discount_pct != null && Number(r.discount_pct) >= 20 ? "text-amber-600 dark:text-amber-400 font-medium" : "",
        },
      ]}
    />
  );
}
