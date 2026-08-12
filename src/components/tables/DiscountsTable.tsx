"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { DiscountRow } from "@/lib/reports";

export default function DiscountsTable({ rows }: { rows: DiscountRow[] }) {
  const filters: FilterConfig<DiscountRow>[] = [
    { type: "select", key: "store_name", label: "Store", value: (r) => r.store_name ?? "" },
    { type: "select", key: "user_name", label: "User", value: (r) => r.user_name ?? "" },
    { type: "select", key: "pos_flag", label: "Channel", value: (r) => r.pos_flag ?? "" },
    { type: "numberMin", key: "amountMin", label: "Amount ≥", value: (r) => Number(r.total_discounts) || 0 },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["user_name", "discount_name", "order_id", "store_name"]}
      searchPlaceholder="Search user, discount, order..."
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
        { key: "order_id", header: "Order" },
        {
          key: "pos_flag",
          header: "Channel",
          render: (r) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                r.pos_flag === "POS" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {r.pos_flag}
            </span>
          ),
        },
      ]}
    />
  );
}
