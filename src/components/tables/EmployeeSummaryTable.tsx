"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { EmployeeSummaryRow } from "@/lib/reports";

const money = (n: string | number | null) =>
  n == null
    ? "—"
    : `${Number(n) < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export default function EmployeeSummaryTable({ rows }: { rows: EmployeeSummaryRow[] }) {
  const filters: FilterConfig<EmployeeSummaryRow>[] = [
    { type: "numberMin", key: "grossSalesMin", label: "Gross Sales ≥", value: (r) => Number(r.gross_sales) || 0 },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["user_name"]}
      searchPlaceholder="Search sales representative..."
      filters={filters}
      emptyMessage="No employee sales found for this filter."
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
