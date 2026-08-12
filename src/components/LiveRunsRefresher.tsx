"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a sync run is in progress, re-fetches the page every few seconds so
 * the Recent Runs table's current_step column stays live for any viewer —
 * not just the browser tab that clicked Sync Now. */
export default function LiveRunsRefresher({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
