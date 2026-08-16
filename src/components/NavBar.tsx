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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-24 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <Image
            src="/logo.avif"
            alt="Maceoo"
            width={72}
            height={72}
            className="rounded-lg object-contain w-10 h-10 sm:w-[72px] sm:h-[72px] shrink-0"
            unoptimized
            priority
          />
          <span className="font-semibold text-sm sm:text-lg text-white truncate">Maceoo Dashboard</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {displayName && <span className="hidden sm:inline text-sm text-slate-300">{displayName}</span>}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
      {/* flex-nowrap + overflow-x-auto instead of flex-wrap: this row's height
          is fixed (h-12) so the sticky filter bar below it can rely on a
          known offset — wrapping tabs would overflow that fixed height and
          overlap the page content instead of just growing the header. */}
      <div className="border-t border-slate-800 bg-slate-950/40 h-12">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-1.5 flex-nowrap overflow-x-auto">
          <NavLinks links={isAdmin ? [...links, ...adminLinks] : links} />
        </div>
      </div>
    </header>
  );
}
