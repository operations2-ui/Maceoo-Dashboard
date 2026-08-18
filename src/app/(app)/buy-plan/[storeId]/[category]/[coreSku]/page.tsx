import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getBuyPlanItems } from "@/lib/reports";
import { slugToCategory } from "@/lib/buy-plan-slugs";
import BuyPlanItemTable from "@/components/tables/BuyPlanItemTable";

export default async function BuyPlanStylePage({
  params,
}: {
  params: Promise<{ storeId: string; category: string; coreSku: string }>;
}) {
  const { storeId, category: categorySlug, coreSku: coreSkuSlug } = await params;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const store = stores.find((s) => s.id === storeId);
  if (!store) notFound();

  const categoryLabel = slugToCategory(categorySlug) || "(Uncategorized)";
  const coreSku = decodeURIComponent(coreSkuSlug);
  const rows = await getBuyPlanItems(storeId, coreSku);
  const description = rows.find((r) => r.description)?.description;

  return (
    <div>
      <Link
        href={`/buy-plan/${storeId}/${categorySlug}`}
        className="text-sm text-blue-700 dark:text-blue-400 hover:underline"
      >
        ← {categoryLabel}
      </Link>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 mb-1">
        {coreSku}
        {description ? ` — ${description}` : ""}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Sizes/colors of this style at {store.name}. Click an Insufficient row to see which other store has spare
        stock to transfer from.
      </p>
      <BuyPlanItemTable rows={rows} storeId={storeId} />
    </div>
  );
}
