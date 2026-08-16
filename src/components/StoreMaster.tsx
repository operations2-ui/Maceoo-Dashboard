"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Store {
  id: string;
  name: string;
  code: string | null;
  to_email: string | null;
  cc_email: string | null;
}
interface Alias {
  store_id: string;
  source: "inventory" | "sheet" | "vendor";
  alias_name: string;
}

interface StoreFormState {
  inventory: string;
  sheet: string;
  vendor: string;
  toEmail: string;
  ccEmail: string;
}

function aliasesFor(aliases: Alias[], storeId: string, source: Alias["source"]): string {
  return aliases
    .filter((a) => a.store_id === storeId && a.source === source)
    .map((a) => a.alias_name)
    .join(", ");
}

function buildInitialState(stores: Store[], aliases: Alias[]): Record<string, StoreFormState> {
  const state: Record<string, StoreFormState> = {};
  for (const s of stores) {
    state[s.id] = {
      inventory: aliasesFor(aliases, s.id, "inventory"),
      sheet: aliasesFor(aliases, s.id, "sheet"),
      vendor: aliasesFor(aliases, s.id, "vendor"),
      toEmail: s.to_email ?? "",
      ccEmail: s.cc_email ?? "",
    };
  }
  return state;
}

function AddStoreForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), code: code.trim() || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Add failed");
      return;
    }
    setName("");
    setCode("");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Store name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Maceoo ilani"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-64"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Code (optional)</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. ILANI"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-32"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add store"}
      </button>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}

function fieldInputClass(dirty: boolean) {
  return `rounded-md border px-2 py-1 text-sm dark:bg-slate-800 dark:text-white ${
    dirty
      ? "border-amber-400 dark:border-amber-500 ring-1 ring-amber-200 dark:ring-amber-900"
      : "border-slate-300 dark:border-slate-700"
  }`;
}

export default function StoreMaster({ stores, aliases }: { stores: Store[]; aliases: Alias[] }) {
  const router = useRouter();
  // `saved` is the last-persisted baseline used for dirty-checking — separate
  // from the `stores`/`aliases` props (which only refresh on router.refresh())
  // so fields un-highlight immediately after a successful save.
  const initial = useMemo(() => buildInitialState(stores, aliases), [stores, aliases]);
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ savedCount: number; errors: string[] } | null>(null);

  function setField(storeId: string, field: keyof StoreFormState, value: string) {
    setValues((prev) => ({ ...prev, [storeId]: { ...prev[storeId], [field]: value } }));
    setResult(null);
  }

  const dirtyStores = stores.filter((s) => {
    const v = values[s.id];
    const sv = saved[s.id];
    return (
      v.inventory !== sv.inventory ||
      v.sheet !== sv.sheet ||
      v.vendor !== sv.vendor ||
      v.toEmail !== sv.toEmail ||
      v.ccEmail !== sv.ccEmail
    );
  });
  const dirty = dirtyStores.length > 0;

  async function saveAll() {
    if (!dirty) return;
    setSaving(true);
    setResult(null);

    const errors: string[] = [];
    let savedCount = 0;
    const nextSaved = { ...saved };

    await Promise.all(
      dirtyStores.map(async (s) => {
        const v = values[s.id];
        const sv = saved[s.id];
        const tasks: Promise<void>[] = [];

        (["inventory", "sheet", "vendor"] as const).forEach((source) => {
          if (v[source] === sv[source]) return;
          const aliasList = v[source]
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);
          tasks.push(
            fetch("/api/admin/store-aliases", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ storeId: s.id, source, aliases: aliasList }),
            }).then(async (res) => {
              if (!res.ok) {
                const data = await res.json();
                errors.push(`${s.name} (${source}): ${data.error ?? "save failed"}`);
              } else {
                nextSaved[s.id] = { ...nextSaved[s.id], [source]: v[source] };
                savedCount++;
              }
            }),
          );
        });

        if (v.toEmail !== sv.toEmail || v.ccEmail !== sv.ccEmail) {
          tasks.push(
            fetch("/api/admin/store-emails", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ storeId: s.id, toEmail: v.toEmail, ccEmail: v.ccEmail }),
            }).then(async (res) => {
              if (!res.ok) {
                const data = await res.json();
                errors.push(`${s.name} (email): ${data.error ?? "save failed"}`);
              } else {
                nextSaved[s.id] = { ...nextSaved[s.id], toEmail: v.toEmail, ccEmail: v.ccEmail };
                savedCount++;
              }
            }),
          );
        }

        await Promise.all(tasks);
      }),
    );

    setSaved(nextSaved);
    setSaving(false);
    setResult({ savedCount, errors });
    router.refresh();
  }

  return (
    <div>
      <AddStoreForm />

      <div className="flex items-center gap-3 mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving || !dirty}
          className={`rounded-md text-white text-sm font-medium px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
            dirty ? "bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {dirty && !saving && (
          <span className="text-sm text-amber-600 dark:text-amber-400">
            {dirtyStores.length} store{dirtyStores.length === 1 ? "" : "s"} with unsaved changes
          </span>
        )}
        {result && result.errors.length === 0 && (
          <span className="text-sm text-green-600 dark:text-green-400">
            ✓ Saved {result.savedCount} change{result.savedCount === 1 ? "" : "s"}
          </span>
        )}
        {result && result.errors.length > 0 && (
          <div className="text-sm text-red-600 dark:text-red-400">
            {result.savedCount > 0 && <span>Saved {result.savedCount}, but: </span>}
            {result.errors.join("; ")}
          </div>
        )}
      </div>

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
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
              Vendor Name (NetSuite) alias(es)
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
              Prior-Day Oversell Alert — To / CC Email
            </th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => {
            const v = values[s.id];
            const sv = saved[s.id];
            return (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-900 dark:text-white">{s.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">{s.code ?? "—"}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={v.inventory}
                    onChange={(e) => setField(s.id, "inventory", e.target.value)}
                    placeholder="comma-separated aliases"
                    className={`${fieldInputClass(v.inventory !== sv.inventory)} w-64`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={v.sheet}
                    onChange={(e) => setField(s.id, "sheet", e.target.value)}
                    placeholder="comma-separated aliases"
                    className={`${fieldInputClass(v.sheet !== sv.sheet)} w-64`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={v.vendor}
                    onChange={(e) => setField(s.id, "vendor", e.target.value)}
                    placeholder="comma-separated aliases"
                    className={`${fieldInputClass(v.vendor !== sv.vendor)} w-64`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="email"
                      value={v.toEmail}
                      onChange={(e) => setField(s.id, "toEmail", e.target.value)}
                      placeholder="To email"
                      className={`${fieldInputClass(v.toEmail !== sv.toEmail)} w-48`}
                    />
                    <input
                      type="email"
                      value={v.ccEmail}
                      onChange={(e) => setField(s.id, "ccEmail", e.target.value)}
                      placeholder="CC email (optional)"
                      className={`${fieldInputClass(v.ccEmail !== sv.ccEmail)} w-48`}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
