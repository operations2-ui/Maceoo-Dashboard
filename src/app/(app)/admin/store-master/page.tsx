import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import StoreMaster from "@/components/StoreMaster";

export default async function StoreMasterPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/");

  const [{ rows: stores }, { rows: aliases }] = await Promise.all([
    pool.query("select id, name, code from stores order by name"),
    pool.query("select store_id, source, alias_name from store_aliases"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Store Master</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Map each canonical store to the names it appears under in other systems: the Drive folder name for daily
        inventory CSVs, and the &quot;Location Name&quot; text used in the Discounts/Sales Google Sheets. These
        don&apos;t need to match the store name above — the importer uses these aliases first, falling back to a
        fuzzy name match only if no alias is set.
      </p>
      <StoreMaster stores={stores} aliases={aliases} />
    </div>
  );
}
