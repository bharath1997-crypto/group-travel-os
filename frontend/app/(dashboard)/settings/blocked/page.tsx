"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

import { SettingsScreenHeader } from "../_components";

type BlockedUser = {
  id: string;
  full_name: string;
  username: string | null;
};

export default function SettingsBlockedPage() {
  const [rows, setRows] = useState<BlockedUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const list = await apiFetch<BlockedUser[]>("/social/blocked");
      setRows(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unblock(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/social/block/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unblock failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SettingsScreenHeader title="Blocked" backHref="/settings" />
      {err ? <p className="px-4 py-2 text-sm text-red-600">{err}</p> : null}
      {!rows ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-stone-600">
          No blocked accounts. People you block cannot message you or see your
          profile in search.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">
                  {u.full_name}
                </p>
                {u.username ? (
                  <p className="truncate text-xs text-stone-500">@{u.username}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy === u.id}
                className="shrink-0 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-[#E94560] disabled:opacity-50"
                onClick={() => void unblock(u.id)}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
