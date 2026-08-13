import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores, hasStoreAccess } from "@/lib/authz";
import { getNegativeInventory } from "@/lib/reports";
import { StoreDateFilter } from "@/components/FilterForm";
import NegativeInventoryTable from "@/components/tables/NegativeInventoryTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";

export default async function NegativeInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; date?: string }>;
}) {
  const { store, date } = await searchParams;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const storeId = store ?? stores[0]?.id;
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  const rows = storeId && (await hasStoreAccess(user, storeId)) ? await getNegativeInventory(storeId, snapshotDate) : [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Negative Inventory</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        SKUs with negative on-hand quantity as of the selected date.
      </p>
      <StoreDateFilter stores={stores} store={storeId} date={snapshotDate} />
      {rows.length > 0 && storeId && (
        <div className="flex justify-end mb-2">
          <DownloadCsvLink href={`/api/export/inventory-negative?store=${storeId}&date=${snapshotDate}`} />
        </div>
      )}
      <NegativeInventoryTable rows={rows} />
    </div>
  );
}
