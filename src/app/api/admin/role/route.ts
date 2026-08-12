import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { userId, role } = await request.json();
  if (typeof userId !== "string" || (role !== "admin" && role !== "store_manager")) {
    return NextResponse.json({ error: "userId and a valid role are required" }, { status: 400 });
  }

  await pool.query("update app_users set role = $1 where id = $2", [role, userId]);
  return NextResponse.json({ ok: true });
}
