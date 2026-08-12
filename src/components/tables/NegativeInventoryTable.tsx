"use client";

import FilterableTable, { type FilterConfig } from "@/components/FilterableTable";
import type { NegativeInventoryRow } from "@/lib/reports";

export default function NegativeInventoryTable({ rows }: { rows: NegativeInventoryRow[] }) {
  const filters: FilterConfig<NegativeInventoryRow>[] = [
    { type: "select", key: "vendor", label: "Vendor", value: (r) => r.vendor ?? "" },
    { type: "numberMin", key: "onHandMin", label: "On Hand ≥", value: (r) => r.on_hand },
    { type: "numberMax", key: "onHandMax", label: "On Hand ≤", value: (r) => r.on_hand },
  ];

  return (
    <FilterableTable
      rows={rows}
      searchKeys={["sku", "style_code", "description", "vendor"]}
      searchPlaceholder="Search SKU, description, vendor..."
      filters={filters}
      emptyMessage="No negative-inventory SKUs for this store and date."
      columns={[
        { key: "sku", header: "SKU" },
        { key: "style_code", header: "Style" },
        { key: "size_code", header: "Size", align: "right" },
        { key: "description", header: "Description", truncate: true },
        { key: "vendor", header: "Vendor", truncate: true },
        {
          key: "on_hand",
          header: "On Hand",
          align: "right",
          cellClassName: (r) => (r.on_hand < 0 ? "text-red-600 font-semibold" : ""),
        },
      ]}
    />
  );
}
