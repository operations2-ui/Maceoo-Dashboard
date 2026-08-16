"use client";

import { useState } from "react";
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

function AliasCell({
  storeId,
  source,
  initial,
}: {
  storeId: string;
  source: "inventory" | "sheet" | "vendor";
  initial: string[];
}) {
  const initialValue = initial.join(", ");
  const [value, setValue] = useState(initialValue);
  // Tracks the last value actually persisted, separate from `initial` (which only
  // updates on a full page refresh) so the Save button un-highlights right after saving.
  const [savedValue, setSavedValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== savedValue;

  async function save() {
    if (!dirty) return;
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
      setSavedValue(value);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 1500);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="comma-separated aliases"
        className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-sm w-64"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className={`rounded-md text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
          dirty ? "bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {savedAt && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

function EmailPairCell({
  storeId,
  initialTo,
  initialCc,
}: {
  storeId: string;
  initialTo: string | null;
  initialCc: string | null;
}) {
  const [to, setTo] = useState(initialTo ?? "");
  const [cc, setCc] = useState(initialCc ?? "");
  // Tracks the last persisted values, separate from the initial props (which only
  // update on a full page refresh) so the Save button un-highlights right after saving.
  const [savedTo, setSavedTo] = useState(initialTo ?? "");
  const [savedCc, setSavedCc] = useState(initialCc ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = to !== savedTo || cc !== savedCc;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/store-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, toEmail: to, ccEmail: cc }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
    } else {
      setSavedTo(to);
      setSavedCc(cc);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 1500);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="email"
        value={to}
        onChange={(e) => {
          setTo(e.target.value);
          setError(null);
        }}
        placeholder="To email"
        className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-sm w-48"
      />
      <input
        type="email"
        value={cc}
        onChange={(e) => {
          setCc(e.target.value);
          setError(null);
        }}
        placeholder="CC email (optional)"
        className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-sm w-48"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className={`rounded-md text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
          dirty ? "bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
        }`}
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
    <div>
      <AddStoreForm />
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
              <td className="px-3 py-2">
                <AliasCell
                  storeId={s.id}
                  source="vendor"
                  initial={aliases.filter((a) => a.store_id === s.id && a.source === "vendor").map((a) => a.alias_name)}
                />
              </td>
              <td className="px-3 py-2">
                <EmailPairCell storeId={s.id} initialTo={s.to_email} initialCc={s.cc_email} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
