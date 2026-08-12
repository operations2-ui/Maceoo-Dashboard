import { getCurrentUser } from "./current-user";
import type { SessionPayload } from "./session";

export async function requireAdmin(): Promise<
  { ok: true; user: SessionPayload } | { ok: false; status: number; message: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, message: "Not signed in" };
  if (user.role !== "admin") return { ok: false, status: 403, message: "Admin access required" };
  return { ok: true, user };
}
