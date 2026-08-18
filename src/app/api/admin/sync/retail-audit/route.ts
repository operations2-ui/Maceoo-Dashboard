import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runRetailAuditSync, closeStaleSyncRuns } from "@/lib/sync";

// Retail Audit's own budget, independent of inventory/sales — see the note
// in src/lib/sync.ts on why the three phases were split into separate
// invocations (Vercel Hobby's 300s ceiling).
export const maxDuration = 300;

/**
 * Streams newline-delimited JSON progress events while the sync runs, ending
 * with a `{"type":"done",...}` line. No mid-flight cancellation checkpoint —
 * the phase is one fetch-then-COPY operation with nothing to interrupt
 * partway through — but the run can still be flagged cancelled in the
 * Recent Runs table via POST /api/admin/sync/cancel.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      await closeStaleSyncRuns();
      const { rows } = await pool.query(
        "insert into sync_runs (status, sync_type) values ('running', 'retail_audit') returning id",
      );
      const runId = rows[0].id;
      send({ type: "started", runId });

      let progressWrites = Promise.resolve();
      const onProgress = (message: string) => {
        send({ type: "progress", message });
        progressWrites = progressWrites.then(() =>
          pool.query("update sync_runs set current_step = $1 where id = $2", [message, runId]).then(
            () => {},
            () => {},
          ),
        );
      };

      try {
        const summary = await runRetailAuditSync(onProgress);
        await progressWrites;
        const status = summary.errors.length > 0 ? "error" : "success";
        await pool.query(
          "update sync_runs set finished_at = now(), status = $1, summary = $2, current_step = null where id = $3 and status <> 'cancelled'",
          [status, JSON.stringify(summary), runId],
        );
        send({ type: "done", runId, status, summary });
      } catch (e) {
        await progressWrites;
        const message = e instanceof Error ? e.message : String(e);
        await pool.query(
          "update sync_runs set finished_at = now(), status = 'error', error_message = $1, current_step = null where id = $2 and status <> 'cancelled'",
          [message, runId],
        );
        send({ type: "done", runId, status: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
