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

export default function SalesTable({ rows, exactOrderCount }: { rows: SalesRow[]; exactOrderCount?: number }) {
  const filters: FilterConfig<SalesRow>[] = [
    { type: "numberMin", key: "netSalesMin", label: "Net Sales ≥", value: (r) => Number(r.net_sales) || 0 },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["store_name", "order_date"]}
      searchPlaceholder="Search store or date..."
      filters={filters}
      emptyMessage="No sales data for this filter."
      totals={(visible) => {
        const sum = (key: keyof SalesRow) => visible.reduce((s, r) => s + (Number(r[key]) || 0), 0);
        // Each day's own total_orders is exact, but summing across days
        // over-counts any order whose lines land on different days (sold
        // one day, refunded another). exactOrderCount (distinct order_name
        // count from sales_orders) is precise for the whole period, so use
        // it whenever nothing's been filtered out; a search/filter narrows
        // to a subset that count no longer describes, so fall back to the
        // day-summed figure there — the best available without another query.
        const isFullPeriod = visible.length === rows.length;
        const totalOrders = isFullPeriod && exactOrderCount != null ? exactOrderCount : sum("total_orders");
        return {
          order_date: `Total (${visible.length.toLocaleString("en-US")} days)`,
          total_orders: totalOrders.toLocaleString("en-US"),
          gross_sales: money(sum("gross_sales")),
          discounts: money(sum("discounts")),
          refunds: money(sum("refunds")),
          net_sales: money(sum("net_sales")),
          taxes: money(sum("taxes")),
          shipping: money(sum("shipping")),
          total_sales: money(sum("total_sales")),
          cogs: money(sum("cogs")),
          gross_margin: money(sum("gross_margin")),
        };
      }}
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
