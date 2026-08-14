import { getCurrentUser } from "@/lib/auth/current-user";
import { pool } from "@/lib/db";
import NavBar from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Fetched fresh (not from the JWT) so an admin editing a user's name in
  // Users & Access takes effect immediately, not just after their next login.
  let displayName = user?.email;
  if (user) {
    const { rows } = await pool.query("select full_name from app_users where id = $1", [user.sub]);
    displayName = rows[0]?.full_name || user.email;
  }

  return (
    <div className="flex flex-col min-h-screen" suppressHydrationWarning>
      <NavBar isAdmin={user?.role === "admin"} displayName={displayName} />
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
