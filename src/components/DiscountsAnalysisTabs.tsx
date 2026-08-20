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

      {active === "orders" && <SalesOrdersTable rows={orderRows} />}
      {active === "buckets" && <DiscountBucketsTable rows={bucketRows} />}
      {active === "employees" && <EmployeeSummaryTable rows={employeeRows} />}
    </div>
  );
}
