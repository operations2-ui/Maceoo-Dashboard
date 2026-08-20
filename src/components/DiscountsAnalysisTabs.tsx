"use client";

import { useState } from "react";
import type { SalesOrderRow, DiscountBucketRow, EmployeeSummaryRow } from "@/lib/reports";
import SalesOrdersTable from "@/components/tables/SalesOrdersTable";
import DiscountBucketsTable from "@/components/tables/DiscountBucketsTable";
import EmployeeSummaryTable from "@/components/tables/EmployeeSummaryTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";

type TabKey = "orders" | "buckets" | "employees";

const tabs: { key: TabKey; label: string }[] = [
  { key: "orders", label: "Order Level Discounts" },
  { key: "buckets", label: "Discount % Distribution" },
  { key: "employees", label: "Summary Report — Employee Wise" },
];

const searchPlaceholder: Record<TabKey, string> = {
  orders: "Search order, user, or store...",
  buckets: "",
  employees: "Search sales representative...",
};

export default function DiscountsAnalysisTabs({
  orderRows,
  bucketRows,
  employeeRows,
  exportQs,
}: {
  orderRows: SalesOrderRow[];
  bucketRows: DiscountBucketRow[];
  employeeRows: EmployeeSummaryRow[];
  exportQs: string;
}) {
  const [active, setActive] = useState<TabKey>("orders");
  // One search box for the whole page, on top of the page-level Store/Date
  // filter — the Discount % Distribution tab is a small fixed set of
  // buckets with nothing to search, so the box is hidden there rather than
  // shown but inert.
  const [search, setSearch] = useState("");

  const exportHref =
    active === "orders"
      ? `/api/export/sales-orders?${exportQs}`
      : active === "buckets"
        ? `/api/export/discount-buckets?${exportQs}`
        : `/api/export/employee-summary?${exportQs}`;
  const hasRows =
    active === "orders" ? orderRows.length > 0 : active === "buckets" ? bucketRows.length > 0 : employeeRows.length > 0;

  return (
    <div>
      {active !== "buckets" && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder[active]}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-72"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-4 border-b border-slate-200 dark:border-slate-800 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
              active === t.key
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end mb-3">{hasRows && <DownloadCsvLink href={exportHref} />}</div>

      {active === "orders" && <SalesOrdersTable rows={orderRows} search={search} />}
      {active === "buckets" && <DiscountBucketsTable rows={bucketRows} />}
      {active === "employees" && <EmployeeSummaryTable rows={employeeRows} search={search} />}
    </div>
  );
}
