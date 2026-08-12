import Image from "next/image";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

const links = [
  { href: "/inventory/negative", label: "Negative Inventory" },
  { href: "/inventory/sold-negative", label: "Prior-Day Oversell" },
  { href: "/inventory/missing-sizes", label: "Missing Sizes" },
  { href: "/discounts", label: "Discounts" },
  { href: "/sales", label: "Sales" },
];

export default function NavBar({ isAdmin, email }: { isAdmin: boolean; email?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white" suppressHydrationWarning>
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
          <span className="font-semibold text-slate-900">Maceoo Dashboard</span>
        </Link>
        <nav className="flex items-center gap-4 flex-wrap text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-600 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link href="/admin/import" className="text-slate-600 hover:text-slate-900">
                Admin Import
              </Link>
              <Link href="/admin/stores" className="text-slate-600 hover:text-slate-900">
                Users &amp; Access
              </Link>
              <Link href="/admin/store-master" className="text-slate-600 hover:text-slate-900">
                Store Master
              </Link>
              <Link href="/admin/sync" className="text-slate-600 hover:text-slate-900">
                Sync
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          {email && <span className="text-xs text-slate-400">{email}</span>}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
