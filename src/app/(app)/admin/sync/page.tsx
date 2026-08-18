import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import SyncNowButton from "@/components/SyncNowButton";
import CancelRunButton from "@/components/CancelRunButton";
import LiveRunsRefresher from "@/components/LiveRunsRefresher";
import DataTable from "@/components/DataTable";

export default async function SyncPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/");

  const { rows } = await pool.query(
    `select id, to_char(started_at, 'YYYY-MM-DD HH24:MI:SS') as started_at,
            to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS') as finished_at,
            status, sync_type, summary, error_message, current_step
     from sync_runs
     order by started_at desc
     limit 20`,
  );
  const hasRunning = rows.some((r) => r.status === "running");

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Drive/Sheets Sync</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Pulls the latest inventory CSVs from Drive and the Sales Google Sheet directly, using the configured
        service account. The Sales sheet also carries discount usage, so a separate Discounts sheet isn&apos;t
        needed. Inventory folders are discovered automatically from whatever&apos;s shared with the service
        account (or under <code>DRIVE_ROOT_FOLDER_ID</code> if set); requires <code>SALES_SHEET_ID</code> to be
        set. Only the last 30 days of inventory are kept. The three phases run as separate syncs, each with its
        own time budget — trigger them one after another rather than all at once.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <SyncNowButton phase="inventory" label="Sync Inventory" />
        <SyncNowButton phase="sales" label="Sync Sales" />
        <SyncNowButton phase="retail-audit" label="Sync Retail Audit" />
      </div>
      <LiveRunsRefresher active={hasRunning} />
      <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recent runs</h2>
      <DataTable
        rows={rows}
        emptyMessage="No sync runs yet."
        columns={[
          { key: "started_at", header: "Started" },
          { key: "finished_at", header: "Finished" },
          {
            key: "sync_type",
            header: "Type",
            render: (r) =>
              r.sync_type === "retail_audit" ? "Retail Audit" : r.sync_type[0].toUpperCase() + r.sync_type.slice(1),
          },
          { key: "status", header: "Status" },
          {
            key: "current_step",
            header: "Current step",
            render: (r) => (r.status === "running" ? (r.current_step ?? "Starting…") : "—"),
          },
          {
            key: "action",
            header: "",
            render: (r) => (r.status === "running" ? <CancelRunButton runId={r.id} /> : null),
          },
          {
            key: "pruned",
            header: "Pruned (>30d)",
            render: (r) => r.summary?.inventoryPruned ?? "—",
          },
          {
            key: "note",
            header: "Note",
            render: (r) =>
              r.summary?.inventoryStoppedEarly ? (
                <span className="text-amber-600 dark:text-amber-400">
                  Inventory backfill incomplete — continues next sync
                </span>
              ) : (
                "—"
              ),
          },
          {
            key: "errors",
            header: "Errors",
            render: (r) => (r.summary?.errors?.length ? r.summary.errors.join("; ") : r.error_message ?? "—"),
          },
        ]}
      />
    </div>
  );
}
