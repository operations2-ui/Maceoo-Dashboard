"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelRunButton({ runId }: { runId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    await fetch("/api/admin/sync/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={loading}
      className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
    >
      {loading ? "Stopping…" : "Stop"}
    </button>
  );
}
