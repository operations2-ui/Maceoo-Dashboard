"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { SalesOrderRow } from "@/lib/reports";

const money = (n: string | number | null) =>
  n == null
    ? "—"
    : `${Number(n) < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export default function SalesOrdersTable({ rows }: { rows: SalesOrderRow[] }) {
  const filters: FilterConfig<SalesOrderRow>[] = [
    { type: "select", key: "store_name", label: "Store", value: (r) => r.store_name ?? "" },
    { type: "select", key: "user_name", label: "User", value: (r) => r.user_name ?? "" },
    { type: "numberMin", key: "discountPctMin", label: "Discount % ≥", value: (r) => Number(r.discount_pct) || 0 },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["order_name", "user_name", "store_name"]}
      searchPlaceholder="Search order, user, or store..."
      filters={filters}
      emptyMessage="No orders found for this filter."
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
