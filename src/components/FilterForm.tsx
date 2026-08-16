import type { AccessibleStore } from "@/lib/authz";

// Sticks directly below NavBar. NavBar's own height is responsive (h-16+h-12
// on mobile = 112px = top-28; h-24+h-12 on sm+ = 144px = top-36) — must track
// NavBar's breakpoint exactly or this offset drifts and the filter overlaps
// either the nav or the page content.
const stickyBarClass =
  "sticky top-28 sm:top-36 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800";

export function StoreDateFilter({
  stores,
  store,
  date,
}: {
  stores: AccessibleStore[];
  store?: string;
  date?: string;
}) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const storeName = store && store !== "all" ? stores.find((s) => s.id === store)?.name ?? "Unknown store" : "All stores";
  return (
    <div className={stickyBarClass}>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Store</label>
          <select
            name="store"
            defaultValue={store ?? "all"}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm min-w-[10rem]"
          >
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={date ?? yesterday}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 transition-colors duration-150 active:scale-95">
          Apply
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400 w-full sm:w-auto sm:ml-auto">
          Showing: <span className="font-medium text-slate-700 dark:text-slate-200">{storeName}</span> ·{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{date ?? yesterday}</span>
        </span>
      </form>
    </div>
  );
}

export function StoreDateRangeFilter({
  stores,
  store,
  from,
  to,
}: {
  stores: AccessibleStore[];
  store?: string;
  from?: string;
  to?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const storeName = store && store !== "all" ? stores.find((s) => s.id === store)?.name ?? "Unknown store" : "All stores";
  return (
    <div className={stickyBarClass}>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Store</label>
          <select
            name="store"
            defaultValue={store ?? "all"}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm min-w-[10rem]"
          >
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? monthAgo}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? today}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 transition-colors duration-150 active:scale-95">
          Apply
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400 w-full sm:w-auto sm:ml-auto">
          Showing: <span className="font-medium text-slate-700 dark:text-slate-200">{storeName}</span> ·{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {from ?? monthAgo} to {to ?? today}
          </span>
        </span>
      </form>
    </div>
  );
}
