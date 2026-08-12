import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * Flags a running sync to stop at its next checkpoint, and marks it
 * "cancelled" immediately regardless — covers both a live run (which will
 * notice the flag within a few seconds) and a genuinely orphaned row with no
 * live process left to notice anything (e.g. left behind by a killed dev
 * server), which would otherwise sit as "running" forever.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const runId = body?.runId;
  if (!runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });

  const { rowCount } = await pool.query(
    `update sync_runs
     set cancel_requested = true, status = 'cancelled', finished_at = coalesce(finished_at, now()), current_step = null
     where id = $1 and status = 'running'`,
    [runId],
  );

  return NextResponse.json({ ok: true, updated: rowCount ?? 0 });
}
