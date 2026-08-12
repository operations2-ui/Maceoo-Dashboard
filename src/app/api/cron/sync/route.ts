import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { runSync } from "@/lib/sync";

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

  const { rows } = await pool.query("insert into sync_runs (status) values ('running') returning id");
  const runId = rows[0].id;

  try {
    const summary = await runSync();
    const status = summary.errors.length > 0 ? "error" : "success";
    await pool.query("update sync_runs set finished_at = now(), status = $1, summary = $2 where id = $3", [
      status,
      JSON.stringify(summary),
      runId,
    ]);
    return NextResponse.json({ runId, status, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await pool.query(
      "update sync_runs set finished_at = now(), status = 'error', error_message = $1 where id = $2",
      [message, runId],
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
