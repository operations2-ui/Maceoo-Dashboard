"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { SoldNegativeRow } from "@/lib/reports";

export default function SoldNegativeTable({ rows }: { rows: SoldNegativeRow[] }) {
  const filters: FilterConfig<SoldNegativeRow>[] = [
    { type: "numberMin", key: "itemsSoldMin", label: "Items Sold ≥", value: (r) => r.items_sold },
    { type: "numberMax", key: "currMax", label: "Curr On Hand ≤", value: (r) => r.curr_on_hand },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["sku", "style_code", "description"]}
      searchPlaceholder="Search SKU, description..."
      filters={filters}
      emptyMessage="No flagged SKUs for this store and date."
      columns={[
        { key: "sku", header: "SKU" },
        { key: "style_code", header: "Style" },
        { key: "size_code", header: "Size", align: "right" },
        { key: "description", header: "Description", truncate: true },
        { key: "prev_on_hand", header: "Prev On Hand", align: "right" },
        {
          key: "curr_on_hand",
          header: "Curr On Hand",
          align: "right",
          cellClassName: () => "text-red-600 dark:text-red-400 font-semibold",
        },
        { key: "items_sold", header: "Items Sold", align: "right" },
      ]}
    />
  );
}
