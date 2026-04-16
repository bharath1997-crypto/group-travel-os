"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";

type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
};

export default function GroupsIndexPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const refreshGroups = useCallback(async () => {
    const data = await apiFetch<GroupOut[]>("/groups");
    setGroups(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshGroups();
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load groups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshGroups]);

  const copyCode = useCallback(async (groupId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(groupId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }, []);

  const closeCreateForm = useCallback(() => {
    setShowCreateForm(false);
    setCreateName("");
    setCreateDescription("");
    setCreateError(null);
  }, []);

  const handleCreateGroup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = createName.trim();
      if (!name) {
        setCreateError("Name is required.");
        return;
      }
      setCreateError(null);
      setCreateSubmitting(true);
      try {
        const created = await apiFetch<GroupOut>("/groups", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: createDescription.trim() || null,
          }),
        });
        await refreshGroups();
        closeCreateForm();
        router.push(`/groups/${created.id}`);
      } catch (err) {
        setCreateError(
          err instanceof Error ? err.message : "Failed to create group",
        );
      } finally {
        setCreateSubmitting(false);
      }
    },
    [createName, createDescription, refreshGroups, closeCreateForm, router],
  );

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F3460]">Groups</h1>
          <p className="mt-1 text-sm text-gray-600">
            Select a group on the left to see details, or create a new one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(true);
            setCreateError(null);
          }}
          className="shrink-0 rounded-lg bg-[#E94560] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
        >
          Create Group
        </button>
      </div>

      {showCreateForm ? (
        <form
          onSubmit={handleCreateGroup}
          className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-[#0F3460]">New group</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="group-name"
                className="block text-xs font-medium text-gray-700"
              >
                Name <span className="text-red-600">*</span>
              </label>
              <input
                id="group-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                placeholder="Trip crew, family reunion…"
              />
            </div>
            <div>
              <label
                htmlFor="group-description"
                className="block text-xs font-medium text-gray-700"
              >
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                id="group-description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm text-[#2C3E50] shadow-sm focus:border-[#E94560] focus:outline-none focus:ring-1 focus:ring-[#E94560]/40"
                placeholder="What’s this group for?"
              />
            </div>
          </div>
          {createError ? (
            <p className="mt-3 text-sm text-red-700">{createError}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={createSubmitting}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {createSubmitting ? "Creating…" : "Create Group"}
            </button>
            <button
              type="button"
              onClick={closeCreateForm}
              disabled={createSubmitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : groups.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-[#0F3460]">No groups yet</p>
          <p className="mt-2 text-sm text-gray-600">
            Create a group above, or join with an invite code from the app.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <p className="text-sm text-gray-600">
            Quick open — or use the list on the left.
          </p>
          <ul className="mt-4 space-y-3">
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/groups/${g.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-gray-300"
                >
                  <Avatar name={g.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#2C3E50]">{g.name}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyCode(g.id, g.invite_code);
                      }}
                      className="mt-1 font-mono text-xs text-gray-600 hover:text-gray-900"
                    >
                      {g.invite_code}
                      {copiedId === g.id ? (
                        <span className="ml-2 font-sans text-green-700">
                          Copied
                        </span>
                      ) : null}
                    </button>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
