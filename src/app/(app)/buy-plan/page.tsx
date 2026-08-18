import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getBuyPlanStoreSummary } from "@/lib/reports";
import BuyPlanStoreTable from "@/components/tables/BuyPlanStoreTable";

export default async function BuyPlanPage() {
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const rows = await getBuyPlanStoreSummary(stores.map((s) => s.id));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Buy Plan</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Units sold per store across the last week, month, quarter, and year, plus how many items currently need
        restocking or are sitting idle. Click a store to see item-level detail and transfer suggestions.
      </p>
      <BuyPlanStoreTable rows={rows} />
    </div>
  );
}
