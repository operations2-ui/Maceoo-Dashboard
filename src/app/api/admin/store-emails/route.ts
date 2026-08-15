import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { storeId, toEmail, ccEmail } = await request.json();
  if (typeof storeId !== "string") {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "update stores set to_email = $1, cc_email = $2 where id = $3 returning id",
    [cleanEmail(toEmail), cleanEmail(ccEmail), storeId],
  );
  if (rows.length === 0) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
