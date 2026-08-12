import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";

const reports = [
  { href: "/inventory/negative", title: "Negative Inventory", desc: "SKUs with negative on-hand quantity as of a given date." },
  { href: "/inventory/sold-negative", title: "Prior-Day Oversell", desc: "Closing stock that's negative and lower than the day before." },
  { href: "/inventory/missing-sizes", title: "Missing Sizes", desc: "Gaps in a style's size run for the current day's stock." },
  { href: "/discounts", title: "Discounts", desc: "Discount usage by date, user, and discount name." },
  { href: "/sales", title: "Sales", desc: "Day-wise sales matrix and trends." },
];

export default async function Home() {
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">
        You have access to {stores.length} store{stores.length === 1 ? "" : "s"}.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 transition-colors"
          >
            <h2 className="font-medium text-slate-900">{r.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
