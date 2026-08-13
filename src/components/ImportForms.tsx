"use client";

import { useState } from "react";
import type { AccessibleStore } from "@/lib/authz";

function ResultBox({ result }: { result: unknown }) {
  if (!result) return null;
  return (
    <pre className="mt-3 text-xs bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-md p-3 overflow-x-auto">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function InventoryImportForm({ stores }: { stores: AccessibleStore[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [asOfDate, setAsOfDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !storeId) return;
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("storeId", storeId);
    if (asOfDate) form.append("asOfDate", asOfDate);
    const res = await fetch("/api/import/inventory", { method: "POST", body: form });
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <h3 className="font-medium text-slate-900 dark:text-white">Daily Inventory CSV</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Upload one store&apos;s daily &quot;Physical Inventory Worksheet&quot; CSV. The date is read from the
        file&apos;s &quot;As of&quot; line unless you override it below.
      </p>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Store</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date override (optional)</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-700 dark:text-slate-300"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
      <ResultBox result={result} />
    </form>
  );
}

function SheetImportForm({ title, description, endpoint }: { title: string; description: string; endpoint: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(endpoint, { method: "POST", body: form });
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <h3 className="font-medium text-slate-900 dark:text-white">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-700 dark:text-slate-300"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
      <ResultBox result={result} />
    </form>
  );
}

export function DiscountsImportForm() {
  return (
    <SheetImportForm
      title="Discounts Sheet"
      description={'Export the "Discount Amount by Date and Location and User Name Wise" sheet as CSV and upload it here. All stores in one file.'}
      endpoint="/api/import/discounts"
    />
  );
}

export function SalesImportForm() {
  return (
    <SheetImportForm
      title="Sales Sheet"
      description="Export the day-wise sales matrix sheet as CSV and upload it here. All stores in one file."
      endpoint="/api/import/sales"
    />
  );
}
