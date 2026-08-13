import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { name, code } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const cleanName = name.trim();
  const cleanCode = typeof code === "string" && code.trim() ? code.trim() : null;

  try {
    const { rows } = await pool.query(
      "insert into stores (name, code) values ($1, $2) returning id, name, code",
      [cleanName, cleanCode],
    );
    return NextResponse.json({ store: rows[0] });
  } catch (e) {
    const message =
      e instanceof Error && "code" in e && (e as { code?: string }).code === "23505"
        ? "A store with this name or code already exists"
        : e instanceof Error
          ? e.message
          : String(e);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
