import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSalesOrders, getDiscountBuckets, getEmployeeSummary } from "@/lib/reports";
import { StoreDateRangeFilter } from "@/components/FilterForm";
import SalesOrdersTable from "@/components/tables/SalesOrdersTable";
import DiscountBucketsTable from "@/components/tables/DiscountBucketsTable";
import EmployeeSummaryTable from "@/components/tables/EmployeeSummaryTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";

export default async function DiscountsAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string }>;
}) {
  const { store, from, to } = await searchParams;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const allowedIds = stores.map((s) => s.id);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const fromDate = from ?? monthAgo;
  const toDate = to ?? today;

  const storeIds = store && store !== "all" && allowedIds.includes(store) ? [store] : allowedIds;

  const [orderRows, bucketRows, employeeRows] = await Promise.all([
    getSalesOrders(storeIds, fromDate, toDate),
    getDiscountBuckets(storeIds, fromDate, toDate),
    getEmployeeSummary(storeIds, fromDate, toDate),
  ]);

  const exportQs = `store=${store ?? "all"}&from=${fromDate}&to=${toDate}`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Discounts Analysis</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Per-order detail, discount-percentage distribution, and employee-wise summary for the selected store(s) and
        period.
      </p>
      <StoreDateRangeFilter stores={stores} store={store} from={fromDate} to={toDate} />

      <div className="flex items-center justify-between mt-2 mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Orders</h2>
        {orderRows.length > 0 && (
          <DownloadCsvLink href={`/api/export/sales-orders?${exportQs}`} />
        )}
      </div>
      <div className="mb-8">
        <SalesOrdersTable rows={orderRows} />
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Discount % Distribution</h2>
        {bucketRows.length > 0 && (
          <DownloadCsvLink href={`/api/export/discount-buckets?${exportQs}`} />
        )}
      </div>
      <div className="mb-8">
        <DiscountBucketsTable rows={bucketRows} />
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Summary Report — Employee Wise</h2>
        {employeeRows.length > 0 && (
          <DownloadCsvLink href={`/api/export/employee-summary?${exportQs}`} />
        )}
      </div>
      <EmployeeSummaryTable rows={employeeRows} />
    </div>
  );
}
