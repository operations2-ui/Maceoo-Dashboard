import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runSync, SyncCancelledError } from "@/lib/sync";

// Google Sheets fetch + batched DB writes to a remote host can take longer
// than Vercel's 10s default function timeout; extend it explicitly.
export const maxDuration = 60;

/**
 * Streams newline-delimited JSON progress events while the sync runs, ending
 * with a `{"type":"done",...}` line — so the admin UI can show what's
 * currently happening instead of a blank "Syncing…" for up to a minute, and
 * can cancel via POST /api/admin/sync/cancel using the emitted runId.
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

      const { rows } = await pool.query("insert into sync_runs (status) values ('running') returning id");
      const runId = rows[0].id;
      send({ type: "started", runId });

      const checkCancelled = async () => {
        const { rows: flagRows } = await pool.query("select cancel_requested from sync_runs where id = $1", [runId]);
        return flagRows[0]?.cancel_requested === true;
      };

      try {
        const summary = await runSync((message) => send({ type: "progress", message }), checkCancelled);
        const status = summary.errors.length > 0 ? "error" : "success";
        // A cancellation may have raced in between the last checkpoint and
        // here; don't let a late success overwrite it.
        await pool.query(
          "update sync_runs set finished_at = now(), status = $1, summary = $2 where id = $3 and status <> 'cancelled'",
          [status, JSON.stringify(summary), runId],
        );
        send({ type: "done", runId, status, summary });
      } catch (e) {
        if (e instanceof SyncCancelledError) {
          await pool.query(
            "update sync_runs set finished_at = now(), status = 'cancelled' where id = $1",
            [runId],
          );
          send({ type: "done", runId, status: "cancelled" });
        } else {
          const message = e instanceof Error ? e.message : String(e);
          await pool.query(
            "update sync_runs set finished_at = now(), status = 'error', error_message = $1 where id = $2 and status <> 'cancelled'",
            [message, runId],
          );
          send({ type: "done", runId, status: "error", error: message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
