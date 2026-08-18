import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getBuyPlanCategories } from "@/lib/reports";
import { categoryToSlug } from "@/lib/buy-plan-slugs";
import BuyPlanGroupTable from "@/components/tables/BuyPlanGroupTable";

export default async function BuyPlanStorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const store = stores.find((s) => s.id === storeId);
  if (!store) notFound();

  const categories = await getBuyPlanCategories(storeId);
  const rows = categories.map((r) => ({ ...r, href: `/buy-plan/${storeId}/${categoryToSlug(r.group_key)}` }));

  return (
    <div>
      <Link href="/buy-plan" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">
        ← All Stores
      </Link>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 mb-1">{store.name} — Buy Plan</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Product categories at this store. Click a category to see its styles, then a style to see sizes and
        transfer suggestions.
      </p>
      <BuyPlanGroupTable rows={rows} nameHeader="Category" />
    </div>
  );
}
