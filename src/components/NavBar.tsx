import Image from "next/image";
import Link from "next/link";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";
import NavLinks from "./NavLinks";

const links = [
  { href: "/", label: "Overview" },
  { href: "/inventory/negative", label: "Negative Inventory" },
  { href: "/inventory/sold-negative", label: "Prior-Day Oversell" },
  { href: "/inventory/missing-sizes", label: "Missing Sizes" },
  { href: "/sales", label: "Sales" },
  { href: "/discounts-analysis", label: "Discounts Analysis" },
];

const adminLinks = [
  { href: "/admin/stores", label: "Users & Access" },
  { href: "/admin/store-master", label: "Store Master" },
  { href: "/admin/sync", label: "Sync" },
];

// A fixed dark color (not theme-reactive) so the nav reads as distinct chrome
// against the page in both light and dark mode, and stays put while scrolling
// (sticky) so it's never lost on a long page like the Overview dashboard.
export default function NavBar({ isAdmin, displayName }: { isAdmin: boolean; displayName?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900" suppressHydrationWarning>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between gap-4 flex-wrap">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/logo.avif"
            alt="Maceoo"
            width={72}
            height={72}
            className="rounded-lg object-contain"
            unoptimized
            priority
          />
          <span className="font-semibold text-lg text-white">Maceoo Dashboard</span>
        </Link>
        <div className="flex items-center gap-3 shrink-0">
          {displayName && <span className="text-sm text-slate-300">{displayName}</span>}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
      <div className="border-t border-slate-800 bg-slate-950/40 h-12">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-1.5 flex-wrap">
          <NavLinks links={isAdmin ? [...links, ...adminLinks] : links} />
        </div>
      </div>
    </header>
  );
}
