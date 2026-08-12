"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    setProgress("Starting…");

    const res = await fetch("/api/admin/sync", { method: "POST" });
    const reader = res.body?.getReader();
    if (!reader) {
      setResult(await res.json());
      setLoading(false);
      setProgress(null);
      router.refresh();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress") setProgress(event.message);
        else if (event.type === "done") setResult(event);
      }
    }

    setProgress(null);
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
      {loading && progress && <p className="mt-2 text-xs text-slate-500">{progress}</p>}
      {result != null && (
        <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
