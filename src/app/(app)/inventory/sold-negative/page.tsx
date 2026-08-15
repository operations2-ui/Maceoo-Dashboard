import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSoldNegative } from "@/lib/reports";
import { StoreDateFilter } from "@/components/FilterForm";
import SoldNegativeTable from "@/components/tables/SoldNegativeTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";
import NotifyOversellButton from "@/components/NotifyOversellButton";

export default async function SoldNegativePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; date?: string }>;
}) {
  const { store, date } = await searchParams;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const allowedIds = stores.map((s) => s.id);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const snapshotDate = date ?? yesterday;
  const storeIds = store && store !== "all" && allowedIds.includes(store) ? [store] : allowedIds;

  const rows = await getSoldNegative(storeIds, snapshotDate);
  const notifyLabel = storeIds.length === 1 ? "Store Manager" : "All Store Managers";

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Prior-Day Oversell</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        SKUs where today&apos;s closing stock is negative and lower than yesterday&apos;s closing stock.
      </p>
      <StoreDateFilter stores={stores} store={store} date={snapshotDate} />
      {rows.length > 0 && (
        <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
          <NotifyOversellButton storeIds={storeIds} storeLabel={notifyLabel} date={snapshotDate} />
          <DownloadCsvLink href={`/api/export/inventory-sold-negative?store=${store ?? "all"}&date=${snapshotDate}`} />
        </div>
      )}
      <SoldNegativeTable rows={rows} />
    </div>
  );
}
