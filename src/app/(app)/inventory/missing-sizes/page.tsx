import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores, hasStoreAccess } from "@/lib/authz";
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
  const storeId = store ?? stores[0]?.id;
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  const flaggedRows = storeId && (await hasStoreAccess(user, storeId)) ? await getMissingSizes(storeId, snapshotDate) : [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Missing Sizes</h1>
      <p className="text-sm text-slate-500 mb-4">
        Styles where a size in the middle of the run has no row at all in the current day&apos;s stock file
        (distinct from a size that&apos;s present with 0 on hand).
      </p>
      <StoreDateFilter stores={stores} store={storeId} date={snapshotDate} />
      {flaggedRows.length > 0 && storeId && (
        <div className="flex justify-end mb-2">
          <DownloadCsvLink href={`/api/export/inventory-missing-sizes?store=${storeId}&date=${snapshotDate}`} />
        </div>
      )}
      <MissingSizesTable rows={flaggedRows} />
    </div>
  );
}
