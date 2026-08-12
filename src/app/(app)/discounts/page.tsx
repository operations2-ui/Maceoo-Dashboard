import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getDiscounts } from "@/lib/reports";
import { StoreDateRangeFilter } from "@/components/FilterForm";
import DiscountsTable from "@/components/tables/DiscountsTable";
import DownloadCsvLink from "@/components/DownloadCsvLink";

export default async function DiscountsPage({
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

  const rows = await getDiscounts(storeIds, fromDate, toDate);
  const totalDiscounts = rows.reduce((sum, r) => sum + Number(r.total_discounts ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Discounts</h1>
      <p className="text-sm text-slate-500 mb-4">Discount usage by date, location, and user.</p>
      <StoreDateRangeFilter stores={stores} store={store} from={fromDate} to={toDate} />
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-medium">{rows.length.toLocaleString("en-US")}</span> discount
          {rows.length === 1 ? "" : "s"} totaling{" "}
          <span className="font-medium">
            ${totalDiscounts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
        {rows.length > 0 && (
          <DownloadCsvLink
            href={`/api/export/discounts?store=${store ?? "all"}&from=${fromDate}&to=${toDate}`}
          />
        )}
      </div>
      <DiscountsTable rows={rows} />
    </div>
  );
}
