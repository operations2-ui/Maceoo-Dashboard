"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();
    setResult(data);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {loading ? "Syncing…" : "Sync now"}
      </button>
      {result != null && (
        <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
