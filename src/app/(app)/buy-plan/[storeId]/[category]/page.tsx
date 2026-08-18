import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getBuyPlanStyles } from "@/lib/reports";
import { slugToCategory } from "@/lib/buy-plan-slugs";
import BuyPlanGroupTable from "@/components/tables/BuyPlanGroupTable";

export default async function BuyPlanCategoryPage({
  params,
}: {
  params: Promise<{ storeId: string; category: string }>;
}) {
  const { storeId, category: categorySlug } = await params;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const store = stores.find((s) => s.id === storeId);
  if (!store) notFound();

  const category = slugToCategory(categorySlug);
  const categoryLabel = category || "(Uncategorized)";
  const styles = await getBuyPlanStyles(storeId, category);
  const rows = styles.map((r) => ({
    ...r,
    href: `/buy-plan/${storeId}/${categorySlug}/${encodeURIComponent(r.group_key)}`,
  }));

  return (
    <div>
      <Link href={`/buy-plan/${storeId}`} className="text-sm text-blue-700 dark:text-blue-400 hover:underline">
        ← {store.name}
      </Link>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 mb-1">
        {store.name} — {categoryLabel}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Styles in this category. Click a style to see its sizes and transfer suggestions.
      </p>
      <BuyPlanGroupTable rows={rows} nameHeader="Style" />
    </div>
  );
}
