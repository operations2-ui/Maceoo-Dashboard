import type { AccessibleStore } from "@/lib/authz";

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
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 mb-6">
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
      <button type="submit" className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5">
        Apply
      </button>
    </form>
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
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 mb-6">
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
      <button type="submit" className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5">
        Apply
      </button>
    </form>
  );
}
