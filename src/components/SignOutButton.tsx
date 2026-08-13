"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    >
      Sign out
    </button>
  );
}
