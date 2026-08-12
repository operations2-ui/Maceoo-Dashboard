import { getCurrentUser } from "@/lib/auth/current-user";
import NavBar from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col min-h-screen" suppressHydrationWarning>
      <NavBar isAdmin={user?.role === "admin"} email={user?.email} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
