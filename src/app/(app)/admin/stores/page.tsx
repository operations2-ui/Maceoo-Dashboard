import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import AccessManager from "@/components/AccessManager";

export default async function AdminStoresPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/");

  const [{ rows: profiles }, { rows: stores }, { rows: access }] = await Promise.all([
    pool.query("select id as user_id, email, full_name, role from app_users order by email"),
    pool.query("select id, name from stores order by name"),
    pool.query("select user_id, store_id from user_store_access"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Admin: Users &amp; Store Access</h1>
      <p className="text-sm text-slate-500 mb-6">
        Set each user&apos;s role and which stores they can see. Admins see every store automatically.
      </p>
      <AccessManager profiles={profiles} stores={stores} initialAccess={access} />
    </div>
  );
}
