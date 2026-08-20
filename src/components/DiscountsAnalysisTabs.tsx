"use client";

import { useState } from "react";
import type { AccessibleStore } from "@/lib/authz";
import type { SalesOrderRow, DiscountBucketRow, EmployeeSummaryRow } from "@/lib/reports";
import { stickyBarClass } from "@/components/FilterForm";
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
  stores,
  store,
  from,
  to,
  orderRows,
  bucketRows,
  employeeRows,
  exportQs,
}: {
  stores: AccessibleStore[];
  store?: string;
  from: string;
  to: string;
  orderRows: SalesOrderRow[];
  bucketRows: DiscountBucketRow[];
  employeeRows: EmployeeSummaryRow[];
  exportQs: string;
}) {
  const [active, setActive] = useState<TabKey>("orders");
  // One search box for the whole page, sharing the same row as the
  // Store/Date filter — the Discount % Distribution tab is a small fixed
  // set of buckets with nothing to search, so the box is hidden there
  // rather than shown but inert.
  const [search, setSearch] = useState("");
  const storeName = store && store !== "all" ? stores.find((s) => s.id === store)?.name ?? "Unknown store" : "All stores";

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
      <div className={stickyBarClass}>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Store</label>
            <select
              name="store"
              defaultValue={store ?? "all"}
              className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm min-w-[10rem]"
            >
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 transition-colors duration-150 active:scale-95">
            Apply
          </button>
          {active !== "buckets" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Search</label>
              {/* No `name` — this box is purely client-side filtering of the already-loaded rows, not part of the GET submission above. */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder[active]}
                className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-64"
              />
            </div>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400 w-full sm:w-auto sm:ml-auto">
            Showing: <span className="font-medium text-slate-700 dark:text-slate-200">{storeName}</span> ·{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {from} to {to}
            </span>
          </span>
        </form>
      </div>

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
