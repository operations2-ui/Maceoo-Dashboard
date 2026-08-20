"use client";

import FilterableTable from "@/components/FilterableTable";
import type { EmployeeSummaryRow } from "@/lib/reports";

const money = (n: string | number | null) =>
  n == null
    ? "—"
    : `${Number(n) < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

// The single search box above the tabs (in DiscountsAnalysisTabs) is the
// only filter on this page, on top of the page-level Store/Date filter.
export default function EmployeeSummaryTable({ rows, search }: { rows: EmployeeSummaryRow[]; search: string }) {
  return (
    <FilterableTable
      rows={rows}
      searchKeys={["user_name"]}
      search={search}
      hideControls
      emptyMessage="No employee sales found for this filter."
      totals={(visible) => {
        const sum = (key: keyof EmployeeSummaryRow) => visible.reduce((s, r) => s + (Number(r[key]) || 0), 0);
        return {
          user_name: `Total (${visible.length.toLocaleString("en-US")} reps)`,
          total_orders: sum("total_orders").toLocaleString("en-US"),
          gross_sales: money(sum("gross_sales")),
          discounts: money(sum("discounts")),
          refunds: money(sum("refunds")),
          net_sales: money(sum("net_sales")),
          discounts_over_15: money(sum("discounts_over_15")),
          orders_over_15: sum("orders_over_15").toLocaleString("en-US"),
          gross_sales_over_15: money(sum("gross_sales_over_15")),
        };
      }}
      columns={[
        { key: "user_name", header: "Sales Representative Name", truncate: true },
        { key: "total_orders", header: "Total Orders", align: "right" },
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
          key: "discounts_over_15",
          header: "Discounts >15%",
          align: "right",
          render: (r) => money(r.discounts_over_15),
        },
        { key: "orders_over_15", header: "Orders >15%", align: "right", render: (r) => r.orders_over_15 ?? 0 },
        {
          key: "gross_sales_over_15",
          header: "Gross Sales >15%",
          align: "right",
          render: (r) => money(r.gross_sales_over_15),
        },
      ]}
    />
  );
}
