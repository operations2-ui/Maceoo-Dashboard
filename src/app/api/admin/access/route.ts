import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { userId, storeId, action } = await request.json();
  if (typeof userId !== "string" || typeof storeId !== "string" || (action !== "grant" && action !== "revoke")) {
    return NextResponse.json({ error: "userId, storeId, and a valid action are required" }, { status: 400 });
  }

  if (action === "grant") {
    await pool.query(
      "insert into user_store_access (user_id, store_id) values ($1, $2) on conflict do nothing",
      [userId, storeId],
    );
  } else {
    await pool.query("delete from user_store_access where user_id = $1 and store_id = $2", [userId, storeId]);
  }

  return NextResponse.json({ ok: true });
}
