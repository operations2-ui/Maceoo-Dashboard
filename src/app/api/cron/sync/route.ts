import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { runSync, closeStaleSyncRuns } from "@/lib/sync";

// Since the sales sheet moved to one row per line item, a full current-year
// sync (sales + inventory + retail audit) measured at ~300s and grows through
// the year as more of it fills in — well past Vercel's 10s default. Set high
// with headroom; requires a plan/config that allows functions to run this
// long (e.g. Fluid Compute on Pro).
export const maxDuration = 800;

/**
 * Sync endpoint for Vercel Cron (see vercel.json). Not gated by a user
 * session — Cron has none — but requires a shared secret instead, since this
 * is a real write endpoint and must not be publicly callable.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await closeStaleSyncRuns();
  const { rows } = await pool.query("insert into sync_runs (status) values ('running') returning id");
  const runId = rows[0].id;

  // Same current_step tracking the manual sync uses, so /admin/sync shows
  // live progress for a cron-triggered run too, not just manual ones.
  let progressWrites = Promise.resolve();
  const onProgress = (message: string) => {
    progressWrites = progressWrites.then(() =>
      pool.query("update sync_runs set current_step = $1 where id = $2", [message, runId]).then(
        () => {},
        () => {},
      ),
    );
  };

  try {
    const summary = await runSync(onProgress);
    await progressWrites;
    const status = summary.errors.length > 0 ? "error" : "success";
    await pool.query(
      "update sync_runs set finished_at = now(), status = $1, summary = $2, current_step = null where id = $3",
      [status, JSON.stringify(summary), runId],
    );
    return NextResponse.json({ runId, status, summary });
  } catch (e) {
    await progressWrites;
    const message = e instanceof Error ? e.message : String(e);
    await pool.query(
      "update sync_runs set finished_at = now(), status = 'error', error_message = $1, current_step = null where id = $2",
      [message, runId],
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
