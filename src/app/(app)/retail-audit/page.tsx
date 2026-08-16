import { getRetailAuditDashboard } from "@/lib/reports";
import RetailAuditTable from "@/components/tables/RetailAuditTable";

export default async function RetailAuditPage() {
  const rows = await getRetailAuditDashboard();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Retail Audit</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        One row per purchase order, comparing what was ordered, billed, shipped, and received. Click a row to see
        its SKU-level detail.
      </p>
      <RetailAuditTable rows={rows} />
    </div>
  );
}
