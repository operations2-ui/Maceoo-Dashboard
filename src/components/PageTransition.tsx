"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Re-triggers the fade-in CSS animation on every route change by toggling
// the class via a rAF (forces a style recalc between removing and re-adding
// it, which is what makes a *repeated* CSS animation restart) — deliberately
// NOT keyed by pathname. Keying this wrapper was tried first, but remounting
// it on every navigation tore down and rebuilt the loading.tsx Suspense
// boundary underneath, which left pages stuck on the loading spinner forever
// instead of ever resolving to real content.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-page-in");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add("animate-page-in"));
    });
  }, [pathname]);

  return (
    <div ref={ref} className="animate-page-in">
      {children}
    </div>
  );
}
