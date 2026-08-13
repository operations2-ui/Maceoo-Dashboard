import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSales } from "@/lib/reports";
import { StoreDateRangeFilter } from "@/components/FilterForm";
import SalesTable from "@/components/tables/SalesTable";
import SalesTrendChart from "@/components/SalesTrendChart";
import StoreSalesChart from "@/components/StoreSalesChart";
import DownloadCsvLink from "@/components/DownloadCsvLink";

const money = (n: number | string | null) =>
  n == null
    ? "—"
    : `${Number(n) < 0 ? "-" : ""}$${Math.abs(Number(n)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export default async function SalesPage({
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

  const rows = await getSales(storeIds, fromDate, toDate);

  const totals = rows.reduce(
    (acc, r) => ({
      orders: acc.orders + (r.total_orders ?? 0),
      netSales: acc.netSales + Number(r.net_sales ?? 0),
      grossMargin: acc.grossMargin + Number(r.gross_margin ?? 0),
    }),
    { orders: 0, netSales: 0, grossMargin: 0 },
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Sales</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Day-wise sales matrix for the selected store(s) and period.
      </p>
      <StoreDateRangeFilter stores={stores} store={store} from={fromDate} to={toDate} />

      {rows.length > 0 && (
        <div className="flex justify-end mb-3">
          <DownloadCsvLink href={`/api/export/sales?store=${store ?? "all"}&from=${fromDate}&to=${toDate}`} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white">
            {totals.orders.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net Sales</p>
          <p
            className={`text-xl font-semibold ${totals.netSales < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}
          >
            {money(totals.netSales)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Gross Margin</p>
          <p
            className={`text-xl font-semibold ${totals.grossMargin < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}
          >
            {money(totals.grossMargin)}
          </p>
        </div>
      </div>

      <SalesTrendChart rows={rows} />
      <StoreSalesChart rows={rows} />

      <SalesTable rows={rows} />
    </div>
  );
}
