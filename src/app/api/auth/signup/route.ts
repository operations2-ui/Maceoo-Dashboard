import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: Request) {
  const { email, password, fullName } = await request.json();
  if (typeof email !== "string" || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Valid email and a password of at least 6 characters are required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  let userId: string;
  let role: "admin" | "store_manager";
  try {
    const { rows } = await pool.query(
      `insert into app_users (email, password_hash, full_name)
       values ($1, $2, $3)
       returning id, role`,
      [normalizedEmail, passwordHash, typeof fullName === "string" ? fullName : null],
    );
    userId = rows[0].id;
    role = rows[0].role;
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const token = await createSessionToken({ sub: userId, role, email: normalizedEmail });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);

  return NextResponse.json({ ok: true });
}
