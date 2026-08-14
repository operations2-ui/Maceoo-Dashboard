import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getMissingSizes } from "@/lib/reports";
import { StoreDateFilter } from "@/components/FilterForm";
import MissingSizesTable from "@/components/tables/MissingSizesTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";

export default async function MissingSizesPage({
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

  const flaggedRows = await getMissingSizes(storeIds, snapshotDate);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Missing Sizes</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Styles where a size in the middle of the run has no row at all in the current day&apos;s stock file
        (distinct from a size that&apos;s present with 0 on hand).
      </p>
      <StoreDateFilter stores={stores} store={store} date={snapshotDate} />
      {flaggedRows.length > 0 && (
        <div className="flex justify-end mb-2">
          <DownloadCsvLink href={`/api/export/inventory-missing-sizes?store=${store ?? "all"}&date=${snapshotDate}`} />
        </div>
      )}
      <MissingSizesTable rows={flaggedRows} />
    </div>
  );
}
