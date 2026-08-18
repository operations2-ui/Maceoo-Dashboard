import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getBuyPlanItems } from "@/lib/reports";
import BuyPlanItemTable from "@/components/tables/BuyPlanItemTable";

export default async function BuyPlanStorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const store = stores.find((s) => s.id === storeId);
  if (!store) notFound();

  const rows = await getBuyPlanItems(storeId);

  return (
    <div>
      <Link href="/buy-plan" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">
        ← All Stores
      </Link>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 mb-1">{store.name} — Buy Plan</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        One row per item/size. Click an Insufficient row to see which other store has spare stock to transfer from.
      </p>
      <BuyPlanItemTable rows={rows} storeId={storeId} />
    </div>
  );
}
