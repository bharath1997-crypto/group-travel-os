"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { clearToken, isLoggedIn } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  mapPin?: boolean;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trips", label: "Trips" },
  { href: "/groups", label: "Groups" },
  { href: "/feed", label: "Feed" },
  { href: "/map", label: "Map", mapPin: true },
  { href: "/weather", label: "Weather" },
  { href: "/stats", label: "My Stats" },
];

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21c-4-3-7-6-7-9a7 7 0 1114 0c0 3-3 6-7 9z" />
      <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

type UserMe = { full_name: string; email: string };

/** Seed for avatars: full name, or email when name is empty (matches intended getUserName behavior). */
function avatarSeed(user: UserMe | null): string {
  const name = user?.full_name?.trim() || "";
  if (name) return name;
  return user?.email?.trim() || "Traveler";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserMe | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    let c = false;
    (async () => {
      try {
        const me = await apiFetch<UserMe>("/auth/me");
        if (!c) setUser(me);
      } catch {
        if (!c) setUser({ full_name: "Traveler", email: "" });
      }
    })();
    return () => {
      c = true;
    };
  }, [router]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  const displayName = user?.full_name ?? "Traveler";
  const seed = avatarSeed(user);

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900 text-gray-100 md:flex">
        <div className="border-b border-gray-800 px-4 py-5">
          <p className="text-lg font-semibold tracking-tight text-white">
            Group Travel OS
          </p>
        </div>
        <div className="flex flex-col items-center border-b border-gray-800/80 px-3 pb-4 pt-5">
          <div className="rounded-full p-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-2 ring-white/25 ring-offset-2 ring-offset-gray-900">
            <Avatar name={seed} size={64} />
          </div>
          <p className="mt-2 max-w-[10rem] truncate text-center text-xs font-medium text-white">
            {displayName.trim() || "Traveler"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ href, label, mapPin }) => {
            const active =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800/80 hover:text-white"
                }`}
              >
                {mapPin ? (
                  <MapPinIcon className="h-4 w-4 shrink-0 opacity-90" />
                ) : null}
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-800 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-gray-200 bg-gray-900 px-4 py-3 md:hidden">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-full p-0.5 ring-2 ring-white/20 ring-offset-2 ring-offset-gray-900">
              <Avatar name={seed} size={40} />
            </div>
            <p className="text-sm font-semibold text-white">Group Travel OS</p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {nav.map(({ href, label, mapPin }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200"
              >
                {mapPin ? <MapPinIcon className="h-3.5 w-3.5" /> : null}
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-red-900/50 px-2 py-1 text-xs text-red-200"
            >
              Logout
            </button>
          </nav>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
