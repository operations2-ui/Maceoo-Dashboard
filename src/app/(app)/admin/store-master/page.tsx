import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import StoreMaster from "@/components/StoreMaster";

export default async function StoreMasterPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/");

  const [{ rows: stores }, { rows: aliases }] = await Promise.all([
    pool.query("select id, name, code, to_email, cc_email from stores order by name"),
    pool.query("select store_id, source, alias_name from store_aliases"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Store Master</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Map each canonical store to the names it appears under in other systems: the Drive folder name for daily
        inventory CSVs, the &quot;Location Name&quot; text used in the Discounts/Sales Google Sheets, and the
        &quot;Vendor Name&quot; text used in the NetSuite-sourced PO / Retail Audit data. These don&apos;t need to
        match the store name above — the importer uses these aliases first, falling back to a fuzzy name match
        only if no alias is set. To Email / CC Email are used for the weekly Prior-Day Oversell alert — stores
        without a To Email set are skipped.
      </p>
      <StoreMaster stores={stores} aliases={aliases} />
    </div>
  );
}
