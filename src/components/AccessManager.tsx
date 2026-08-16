"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

function CreateUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("store_manager");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim() || null, role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("store_manager");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-56"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="optional"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-44"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="min 6 characters"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-40"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1.5 text-sm"
        >
          <option value="store_manager">store_manager</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={saving || !email.trim() || password.length < 6}
        className="rounded-md bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50 transition-colors duration-150 active:scale-95"
      >
        {saving ? "Creating…" : "Create user"}
      </button>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}

function EditUserCell({ userId, initialEmail, initialFullName }: { userId: string; initialEmail: string | null; initialFullName: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    email.trim() !== (initialEmail ?? "") || fullName.trim() !== (initialFullName ?? "") || password.length > 0;

  async function save() {
    if (!email.trim() || !dirty) return;
    if (password.length > 0 && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedAt(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: email.trim(),
        fullName: fullName.trim() || null,
        ...(password.length > 0 ? { password } : {}),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setPassword("");
    setSavedAt(Date.now());
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left hover:underline decoration-dotted"
        title="Click to edit"
      >
        {initialEmail ?? initialFullName ?? userId}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSavedAt(null);
          }}
          placeholder="Email"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-xs w-40"
        />
        <input
          type="text"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setSavedAt(null);
          }}
          placeholder="Full name"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-xs w-32"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setSavedAt(null);
          }}
          placeholder="New password (optional)"
          className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1 text-xs w-40"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className={`rounded-md text-white text-xs font-medium px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 ${
            dirty ? "bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-500" : "bg-slate-400 dark:bg-slate-700"
          }`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setEmail(initialEmail ?? "");
            setFullName(initialFullName ?? "");
            setPassword("");
            setError(null);
            setSavedAt(null);
          }}
          className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
        >
          Close
        </button>
        {savedAt && <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Saved</span>}
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      {!error && !savedAt && dirty && (
        <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
      )}
    </div>
  );
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
    <div>
      <CreateUserForm />
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
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                  <EditUserCell userId={p.user_id} initialEmail={p.email} initialFullName={p.full_name} />
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
    </div>
  );
}
