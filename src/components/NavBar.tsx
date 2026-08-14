import Image from "next/image";
import Link from "next/link";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/inventory/negative", label: "Negative Inventory" },
  { href: "/inventory/sold-negative", label: "Prior-Day Oversell" },
  { href: "/inventory/missing-sizes", label: "Missing Sizes" },
  { href: "/sales", label: "Sales" },
];

// A fixed dark color (not theme-reactive) so the nav reads as distinct chrome
// against the page in both light and dark mode, and stays put while scrolling
// (sticky) so it's never lost on a long page like the Overview dashboard.
export default function NavBar({ isAdmin, email }: { isAdmin: boolean; email?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900" suppressHydrationWarning>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo.avif"
            alt="Maceoo"
            width={36}
            height={36}
            className="rounded-md object-contain"
            unoptimized
            priority
          />
          <span className="font-semibold text-white">Maceoo Dashboard</span>
        </Link>
        <nav className="flex items-center gap-4 flex-wrap text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-300 hover:text-white">
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link href="/admin/stores" className="text-slate-300 hover:text-white">
                Users &amp; Access
              </Link>
              <Link href="/admin/store-master" className="text-slate-300 hover:text-white">
                Store Master
              </Link>
              <Link href="/admin/sync" className="text-slate-300 hover:text-white">
                Sync
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          {email && <span className="text-xs text-slate-400">{email}</span>}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
