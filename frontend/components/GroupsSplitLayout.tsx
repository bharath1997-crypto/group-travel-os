"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";

type GroupListItem = {
  id: string;
  name: string;
  description: string | null;
};

export function GroupsSplitLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await apiFetch<GroupListItem[]>("/groups");
    setGroups(data);
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Failed to load groups");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [refresh]);

  return (
    <div className="flex min-h-[min(100dvh,720px)] flex-1 flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200 bg-gray-50 md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-3 md:sticky md:top-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Travel Hub</h2>
            <p className="text-xs text-gray-500">Yours</p>
          </div>
          <Link
            href="/travel-hub"
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100"
          >
            Home
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        ) : error ? (
          <p className="px-3 py-4 text-xs text-red-700">{error}</p>
        ) : groups.length === 0 ? (
          <p className="px-3 py-6 text-sm text-gray-600">
            No groups yet. Use <span className="font-medium">New</span> on the
            main groups page to create one.
          </p>
        ) : (
          <ul className="max-h-[40vh] overflow-y-auto py-2 md:max-h-none">
            {groups.map((g) => {
              const active =
                pathname === `/groups/${g.id}` || pathname.startsWith(`/groups/${g.id}/`);
              return (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className={`flex items-start gap-2 px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-white font-medium text-gray-900 shadow-sm ring-1 ring-gray-200"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Avatar name={g.name} size={32} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{g.name}</span>
                      {g.description ? (
                        <span className="mt-0.5 line-clamp-2 text-xs font-normal text-gray-500">
                          {g.description}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <section className="min-h-[50vh] min-w-0 flex-1 bg-white">{children}</section>
    </div>
  );
}
