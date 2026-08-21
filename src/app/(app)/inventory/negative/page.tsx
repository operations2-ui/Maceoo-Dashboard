import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getCurrentInventory } from "@/lib/reports";
import { StoreDateFilter } from "@/components/FilterForm";
import NegativeInventoryTable from "@/components/tables/NegativeInventoryTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";

export default async function CurrentInventoryPage({
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

  // Unlike the old negative-only report (a handful of rows at most), showing
  // every SKU means "all stores" can be 90,000+ rows across this account's
  // full store list — confirmed that blows past the DB's query timeout, and
  // no browser should try to render that many table rows anyway. Default to
  // the first accessible store rather than all of them; "All stores" stays
  // selectable but shows a prompt instead of attempting the unbounded query.
  const explicitAll = store === "all";
  const requestedStore = store && store !== "all" && allowedIds.includes(store) ? store : undefined;
  const resolvedStore = requestedStore ?? (explicitAll ? undefined : allowedIds[0]);
  const storeIds = resolvedStore ? [resolvedStore] : [];
  // Passed to the filter UI so the dropdown/"Showing:" line always reflects
  // what actually loaded, including the silent single-store default.
  const displayStore = explicitAll ? "all" : resolvedStore;

  const rows = explicitAll || storeIds.length === 0 ? [] : await getCurrentInventory(storeIds, snapshotDate);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Current Inventory</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Every SKU&apos;s on-hand quantity as of the selected date — negative on-hand is highlighted.
      </p>
      <StoreDateFilter stores={stores} store={displayStore} date={snapshotDate} />
      {explicitAll ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Pick a specific store above — showing every SKU across all stores at once is too much data for one page.
        </div>
      ) : (
        <>
          {rows.length > 0 && (
            <div className="flex justify-end mb-2">
              <DownloadCsvLink href={`/api/export/inventory-negative?store=${resolvedStore ?? "all"}&date=${snapshotDate}`} />
            </div>
          )}
          <NegativeInventoryTable rows={rows} />
        </>
      )}
    </div>
  );
}
