import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { hashPassword } from "@/lib/auth/password";

function duplicateEmailOr(e: unknown, fallbackStatus: number): { error: string; status: number } {
  if (e instanceof Error && "code" in e && (e as { code?: string }).code === "23505") {
    return { error: "A user with that email already exists", status: 409 };
  }
  return { error: e instanceof Error ? e.message : String(e), status: fallbackStatus };
}

/** Admin-created account — unlike /api/auth/signup, this doesn't log the admin into the new account. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { email, password, fullName, role } = await request.json();
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Valid email and a password of at least 6 characters are required" }, { status: 400 });
  }
  if (role !== "admin" && role !== "store_manager") {
    return NextResponse.json({ error: "role must be admin or store_manager" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query(
      `insert into app_users (email, password_hash, full_name, role)
       values ($1, $2, $3, $4)
       returning id as user_id, email, full_name, role`,
      [normalizedEmail, passwordHash, typeof fullName === "string" && fullName.trim() ? fullName.trim() : null, role],
    );
    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    const { error, status } = duplicateEmailOr(e, 500);
    return NextResponse.json({ error }, { status });
  }
}

/** Edit an existing user's email, display name, and/or password (role has its own flow). */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { userId, email, fullName, password } = await request.json();
  if (typeof userId !== "string" || typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "userId and a valid email are required" }, { status: 400 });
  }
  if (typeof password === "string" && password.length > 0 && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanFullName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;

  try {
    const { rows } =
      typeof password === "string" && password.length >= 6
        ? await pool.query(
            "update app_users set email = $1, full_name = $2, password_hash = $3 where id = $4 returning id as user_id, email, full_name, role",
            [normalizedEmail, cleanFullName, await hashPassword(password), userId],
          )
        : await pool.query(
            "update app_users set email = $1, full_name = $2 where id = $3 returning id as user_id, email, full_name, role",
            [normalizedEmail, cleanFullName, userId],
          );
    if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    const { error, status } = duplicateEmailOr(e, 500);
    return NextResponse.json({ error }, { status });
  }
}
