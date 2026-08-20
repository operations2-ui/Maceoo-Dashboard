import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSalesOrders, getDiscountBuckets, getEmployeeSummary } from "@/lib/reports";
import { StoreDateRangeFilter } from "@/components/FilterForm";
import DiscountsAnalysisTabs from "@/components/DiscountsAnalysisTabs";

export default async function DiscountsAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string }>;
}) {
  const { store, from, to } = await searchParams;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const allowedIds = stores.map((s) => s.id);

  // Ends at yesterday, not today — today's sync hasn't necessarily run yet,
  // so a "through today" default would silently under-report its own last day.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  const fromDate = from ?? monthAgo;
  const toDate = to ?? yesterday;

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

      <DiscountsAnalysisTabs
        orderRows={orderRows}
        bucketRows={bucketRows}
        employeeRows={employeeRows}
        exportQs={exportQs}
      />
    </div>
  );
}
