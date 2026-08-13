"use client";

import { useState, useTransition } from "react";

interface Profile {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}
interface Store {
  id: string;
  name: string;
}

export default function AccessManager({
  profiles,
  stores,
  initialAccess,
}: {
  profiles: Profile[];
  stores: Store[];
  initialAccess: { user_id: string; store_id: string }[];
}) {
  const [access, setAccess] = useState(
    new Set(initialAccess.map((a) => `${a.user_id}:${a.store_id}`)),
  );
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(profiles.map((p) => [p.user_id, p.role])),
  );
  const [, startTransition] = useTransition();

  function toggleAccess(userId: string, storeId: string) {
    const key = `${userId}:${storeId}`;
    const has = access.has(key);
    startTransition(async () => {
      await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, storeId, action: has ? "revoke" : "grant" }),
      });
    });
    setAccess((prev) => {
      const next = new Set(prev);
      if (has) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function changeRole(userId: string, role: string) {
    setRoles((prev) => ({ ...prev, [userId]: role }));
    startTransition(async () => {
      await fetch("/api/admin/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">User</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Role</th>
            {stores.map((s) => (
              <th
                key={s.id}
                className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
              >
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.user_id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                {p.email ?? p.full_name ?? p.user_id}
              </td>
              <td className="px-3 py-2">
                <select
                  value={roles[p.user_id]}
                  onChange={(e) => changeRole(p.user_id, e.target.value)}
                  className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-xs"
                >
                  <option value="store_manager">store_manager</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              {stores.map((s) => (
                <td key={s.id} className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={access.has(`${p.user_id}:${s.id}`)}
                    disabled={roles[p.user_id] === "admin"}
                    onChange={() => toggleAccess(p.user_id, s.id)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
