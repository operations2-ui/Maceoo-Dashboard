import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { InventoryImportForm, SalesImportForm } from "@/components/ImportForms";

export default async function AdminImportPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/");

  const stores = await getAccessibleStores(user);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Admin: Import Data</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Manual CSV upload. Export the daily inventory CSV per store, and the Sales sheet (which now also carries
        discount usage) as CSV, and upload them here until automated Drive/Sheets sync is connected.
      </p>
      <div className="space-y-4">
        <InventoryImportForm stores={stores} />
        <SalesImportForm />
      </div>
    </div>
  );
}
