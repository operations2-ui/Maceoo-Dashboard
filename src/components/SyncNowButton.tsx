"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    setProgress("Starting…");
    setRunId(null);
    setCancelling(false);

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
        if (event.type === "started") setRunId(event.runId);
        else if (event.type === "progress") setProgress(event.message);
        else if (event.type === "done") setResult(event);
      }
    }

    setProgress(null);
    setRunId(null);
    setCancelling(false);
    setLoading(false);
    router.refresh();
  }

  async function cancel() {
    if (!runId) return;
    setCancelling(true);
    await fetch("/api/admin/sync/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    router.refresh();
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-50 transition-colors duration-150 active:scale-95"
        >
          {loading ? "Syncing…" : "Sync now"}
        </button>
        {loading && runId != null && (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium px-3 py-2 disabled:opacity-50 transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-950 active:scale-95"
          >
            {cancelling ? "Stopping…" : "Stop"}
          </button>
        )}
      </div>
      {loading && progress && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{progress}</p>}
      {result != null && (
        <pre className="mt-3 text-xs bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-md p-3 overflow-x-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
