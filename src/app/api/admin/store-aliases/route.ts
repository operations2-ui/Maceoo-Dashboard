import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { storeId, source, aliases } = await request.json();
  if (
    typeof storeId !== "string" ||
    (source !== "inventory" && source !== "sheet") ||
    !Array.isArray(aliases)
  ) {
    return NextResponse.json({ error: "storeId, source, and aliases[] are required" }, { status: 400 });
  }

  const cleanAliases = [...new Set(aliases.map((a: unknown) => String(a).trim()).filter(Boolean))];

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from store_aliases where store_id = $1 and source = $2", [storeId, source]);
    for (const alias of cleanAliases) {
      await client.query(
        "insert into store_aliases (store_id, source, alias_name) values ($1, $2, $3)",
        [storeId, source, alias],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    const message =
      e instanceof Error && "code" in e && (e as { code?: string }).code === "23505"
        ? "One of these aliases is already assigned to a different store"
        : e instanceof Error
          ? e.message
          : String(e);
    return NextResponse.json({ error: message }, { status: 409 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true });
}
