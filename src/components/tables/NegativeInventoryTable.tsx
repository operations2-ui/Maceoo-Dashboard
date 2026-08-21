"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { NegativeInventoryRow } from "@/lib/reports";

// Store isn't filterable here — the page always scopes to exactly one store
// now (see CurrentInventoryPage), so a second Store control would just show
// one option and do nothing.
export default function NegativeInventoryTable({ rows }: { rows: NegativeInventoryRow[] }) {
  const filters: FilterConfig<NegativeInventoryRow>[] = [
    { type: "select", key: "vendor", label: "Vendor", value: (r) => r.vendor ?? "" },
    { type: "numberMin", key: "onHandMin", label: "On Hand ≥", value: (r) => r.on_hand },
    { type: "numberMax", key: "onHandMax", label: "On Hand ≤", value: (r) => r.on_hand },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["sku", "style_code", "description", "vendor", "store_name"]}
      searchPlaceholder="Search SKU, description, vendor..."
      filters={filters}
      emptyMessage="No inventory found for this filter."
      totals={(visible) => {
        const onHand = visible.reduce((s, r) => s + r.on_hand, 0);
        const negativeCount = visible.filter((r) => r.on_hand < 0).length;
        return {
          store_name: `Total (${visible.length.toLocaleString("en-US")} SKUs)`,
          on_hand: `${onHand.toLocaleString("en-US")}${negativeCount > 0 ? ` (${negativeCount.toLocaleString("en-US")} negative)` : ""}`,
        };
      }}
      columns={[
        { key: "store_name", header: "Store" },
        { key: "sku", header: "SKU" },
        { key: "style_code", header: "Style" },
        { key: "size_code", header: "Size", align: "right" },
        { key: "description", header: "Description", truncate: true },
        { key: "vendor", header: "Vendor", truncate: true },
        {
          key: "on_hand",
          header: "On Hand",
          align: "right",
          cellClassName: (r) => (r.on_hand < 0 ? "text-red-600 dark:text-red-400 font-semibold" : ""),
        },
      ]}
    />
  );
}
