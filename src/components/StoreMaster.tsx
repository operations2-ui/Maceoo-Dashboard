"use client";

import { useState } from "react";

interface Store {
  id: string;
  name: string;
  code: string | null;
}
interface Alias {
  store_id: string;
  source: "inventory" | "sheet";
  alias_name: string;
}

function AliasCell({ storeId, source, initial }: { storeId: string; source: "inventory" | "sheet"; initial: string[] }) {
  const [value, setValue] = useState(initial.join(", "));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const aliases = value
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const res = await fetch("/api/admin/store-aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, source, aliases }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
    } else {
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 1500);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="comma-separated aliases"
        className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-sm w-64"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {savedAt && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

export default function StoreMaster({ stores, aliases }: { stores: Store[]; aliases: Alias[] }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Store</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Code</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
              Inventory folder alias(es)
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
              Sheet Location Name alias(es)
            </th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-900 dark:text-white">{s.name}</td>
              <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">{s.code ?? "—"}</td>
              <td className="px-3 py-2">
                <AliasCell
                  storeId={s.id}
                  source="inventory"
                  initial={aliases.filter((a) => a.store_id === s.id && a.source === "inventory").map((a) => a.alias_name)}
                />
              </td>
              <td className="px-3 py-2">
                <AliasCell
                  storeId={s.id}
                  source="sheet"
                  initial={aliases.filter((a) => a.store_id === s.id && a.source === "sheet").map((a) => a.alias_name)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
