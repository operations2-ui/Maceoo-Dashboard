"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { SalesRow } from "@/lib/reports";

const money = (n: number | string | null) =>
  n == null
    ? "—"
    : `${Number(n) < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export default function SalesTable({ rows }: { rows: SalesRow[] }) {
  const filters: FilterConfig<SalesRow>[] = [
    { type: "select", key: "store_name", label: "Store", value: (r) => r.store_name ?? "" },
    { type: "numberMin", key: "netSalesMin", label: "Net Sales ≥", value: (r) => Number(r.net_sales) || 0 },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["store_name", "order_date"]}
      searchPlaceholder="Search store or date..."
      filters={filters}
      emptyMessage="No sales data for this filter."
      columns={[
        { key: "order_date", header: "Date" },
        { key: "store_name", header: "Store" },
        { key: "total_orders", header: "Orders", align: "right" },
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
        { key: "taxes", header: "Taxes", align: "right", render: (r) => money(r.taxes) },
        { key: "shipping", header: "Shipping", align: "right", render: (r) => money(r.shipping) },
        { key: "total_sales", header: "Total Sales", align: "right", render: (r) => money(r.total_sales) },
        { key: "cogs", header: "COGS", align: "right", render: (r) => money(r.cogs) },
        {
          key: "gross_margin",
          header: "Gross Margin",
          align: "right",
          render: (r) => money(r.gross_margin),
          cellClassName: (r) => (Number(r.gross_margin) < 0 ? "text-red-600 dark:text-red-400" : ""),
        },
      ]}
    />
  );
}
