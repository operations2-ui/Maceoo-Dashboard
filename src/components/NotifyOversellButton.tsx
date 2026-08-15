"use client";

import { useState } from "react";

interface NotifyResult {
  store: string;
  sent: boolean;
  items?: number;
  to?: string;
  reason?: string;
}

export default function NotifyOversellButton({
  storeIds,
  storeLabel,
  date,
}: {
  storeIds: string[];
  storeLabel: string;
  date: string;
}) {
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<NotifyResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function notify() {
    setSending(true);
    setError(null);
    setResults(null);
    const res = await fetch("/api/notify-oversell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeIds, date }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Notify failed");
      return;
    }
    setResults(data.results);
  }

  return (
    <div>
      <button
        type="button"
        onClick={notify}
        disabled={sending}
        className="rounded-md bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
      >
        {sending ? "Sending…" : `Notify ${storeLabel}`}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      {results && (
        <ul className="mt-2 text-sm space-y-1">
          {results.map((r) => (
            <li
              key={r.store}
              className={r.sent ? "text-green-600 dark:text-green-400" : "text-slate-500 dark:text-slate-400"}
            >
              {r.sent
                ? `✓ ${r.store}: sent to ${r.to} (${r.items} item${r.items === 1 ? "" : "s"})`
                : `– ${r.store}: ${r.reason}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
