"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
};

type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  members: GroupMemberOut[];
};

export default function GroupsPage() {
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
        await apiFetch("/groups", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: createDescription.trim() || null,
          }),
        });
        await refreshGroups();
        closeCreateForm();
      } catch (err) {
        setCreateError(
          err instanceof Error ? err.message : "Failed to create group",
        );
      } finally {
        setCreateSubmitting(false);
      }
    },
    [
      createName,
      createDescription,
      refreshGroups,
      closeCreateForm,
    ],
  );

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Groups</h1>
          <p className="mt-1 text-sm text-gray-600">Groups you belong to</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(true);
            setCreateError(null);
          }}
          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Create Group
        </button>
      </div>

      {showCreateForm ? (
        <form
          onSubmit={handleCreateGroup}
          className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-900">New group</h2>
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
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
            className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading groups…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : groups.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-medium text-gray-900">No groups yet</p>
          <p className="mt-2 text-sm text-gray-600">
            Use Create Group above, or join with an invite code.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const memberCount = g.members?.length ?? 0;
            return (
              <article
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/groups/${g.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/groups/${g.id}`);
                  }
                }}
                className="relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 pr-16 shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <div className="absolute right-4 top-4">
                  <Avatar name={g.name} size={32} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{g.name}</h2>
                {g.description ? (
                  <p className="mt-2 text-sm text-gray-600">{g.description}</p>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyCode(g.id, g.invite_code);
                  }}
                  className="mt-4 w-full rounded-lg bg-gray-50 px-3 py-2 text-left font-mono text-sm text-gray-900 ring-1 ring-gray-200 hover:bg-gray-100"
                  title="Click to copy invite code"
                >
                  {g.invite_code}
                  {copiedId === g.id ? (
                    <span className="ml-2 text-xs font-sans text-green-700">
                      Copied!
                    </span>
                  ) : null}
                </button>
                <p className="mt-3 text-xs text-gray-500">
                  {memberCount} member{memberCount === 1 ? "" : "s"}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
