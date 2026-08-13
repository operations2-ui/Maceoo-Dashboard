"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { DiscountRow } from "@/lib/reports";

export default function DiscountsTable({ rows }: { rows: DiscountRow[] }) {
  const filters: FilterConfig<DiscountRow>[] = [
    { type: "select", key: "store_name", label: "Store", value: (r) => r.store_name ?? "" },
    { type: "select", key: "user_name", label: "User", value: (r) => r.user_name ?? "" },
    { type: "numberMin", key: "amountMin", label: "Amount ≥", value: (r) => Number(r.total_discounts) || 0 },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["user_name", "discount_name", "store_name"]}
      searchPlaceholder="Search user, discount, store..."
      filters={filters}
      emptyMessage="No discounts found for this filter."
      columns={[
        { key: "day_date", header: "Date" },
        { key: "store_name", header: "Store" },
        { key: "user_name", header: "User", truncate: true },
        { key: "discount_name", header: "Discount", truncate: true },
        {
          key: "total_discounts",
          header: "Amount",
          align: "right",
          render: (r) =>
            `$${Number(r.total_discounts).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
        { key: "total_orders", header: "Orders", align: "right" },
      ]}
    />
  );
}
