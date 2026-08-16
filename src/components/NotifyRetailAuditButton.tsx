"use client";

import { useState } from "react";

export default function NotifyRetailAuditButton({ poNumber }: { poNumber: string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sentTo: string; storeName: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function notify() {
    setSending(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/retail-audit/notify-po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poNumber }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Notify failed");
      return;
    }
    setResult(data);
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          notify();
        }}
        disabled={sending}
        className="rounded-md bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Notify Store Manager (Physical Count Request)"}
      </button>
      {result && (
        <span className="ml-2 text-xs text-green-600 dark:text-green-400">
          ✓ Sent to {result.storeName} ({result.sentTo}) — {result.count} SKU{result.count === 1 ? "" : "s"}
        </span>
      )}
      {error && <span className="ml-2 text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
