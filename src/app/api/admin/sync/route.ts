import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runSync } from "@/lib/sync";

// Google Sheets fetch + batched DB writes to a remote host can take longer
// than Vercel's 10s default function timeout; extend it explicitly.
export const maxDuration = 60;

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

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
