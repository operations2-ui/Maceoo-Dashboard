import { pool } from "./db";
import type { SessionPayload } from "./auth/session";

export interface AccessibleStore {
  id: string;
  name: string;
  code: string | null;
}

/** Stores the given user is allowed to see. Admins see every store. */
export async function getAccessibleStores(user: SessionPayload | null): Promise<AccessibleStore[]> {
  if (!user) return [];
  if (user.role === "admin") {
    const { rows } = await pool.query("select id, name, code from stores order by name");
    return rows;
  }
  const { rows } = await pool.query(
    `select s.id, s.name, s.code
     from stores s
     join user_store_access a on a.store_id = s.id
     where a.user_id = $1
     order by s.name`,
    [user.sub],
  );
  return rows;
}

/** Throws-free check: is this user allowed to see this store? */
export async function hasStoreAccess(user: SessionPayload | null, storeId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;
  const { rows } = await pool.query(
    "select 1 from user_store_access where user_id = $1 and store_id = $2",
    [user.sub, storeId],
  );
  return rows.length > 0;
}
