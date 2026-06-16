"use client";

import {
  Bell, Bot, Compass, Database,
  LogOut, Map, Plane, Settings, ShieldCheck, Lock,
} from "lucide-react";
import { useCallback, useState } from "react";

import { SettingsHubCard, SettingsSearchInput } from "./_components";

const HUBS = [
  {
    href: "/settings/account-security",
    icon: ShieldCheck,
    iconBg: "#0F766E",
    title: "Account & Security",
    description: "Password, sign-in, devices, 2FA, connected accounts",
  },
  {
    href: "/settings/privacy-safety",
    icon: Lock,
    iconBg: "#1E40AF",
    title: "Privacy & Safety",
    description: "Blocked users, message permissions, safety center",
  },
  {
    href: "/settings/trips-travel",
    icon: Plane,
    iconBg: "#7C3AED",
    title: "Trips & Travel",
    description: "Group permissions, travel docs, loyalty programs, driver mode",
  },
  {
    href: "/settings/maps-trip-live",
    icon: Map,
    iconBg: "#065F46",
    title: "Maps & Trip LIVE",
    description: "Saved places, offline maps, location sharing, LIVE settings",
  },
  {
    href: "/settings/content-discovery",
    icon: Compass,
    iconBg: "#9A3412",
    title: "Content & Discovery",
    description: "Travel interests, event preferences, feed, avatar",
  },
  {
    href: "/settings/wayra-ai",
    icon: Bot,
    iconBg: "#4338CA",
    title: "Wayra AI",
    description: "AI personalization, memory, history, data controls",
    badge: "Beta" as const,
  },
  {
    href: "/settings/messages-notifications",
    icon: Bell,
    iconBg: "#B45309",
    title: "Messages & Notifications",
    description: "Lounge, push notifications, price alerts, group alerts",
  },
  {
    href: "/settings/data-integrations",
    icon: Database,
    iconBg: "#0369A1",
    title: "Data & Integrations",
    description: "Export trips, Google & Apple sync, import data",
  },
  {
    href: "/settings/app-preferences",
    icon: Settings,
    iconBg: "#374151",
    title: "App Preferences",
    description: "Language, currency, units, theme, accessibility",
  },
  {
    href: "/settings/support-legal",
    icon: ShieldCheck,
    iconBg: "#BE185D",
    title: "Support & Legal",
    description: "Help center, privacy policy, terms, delete account",
  },
] as const;

export default function SettingsHubPage() {
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? HUBS.filter((h) =>
        `${h.title} ${h.description}`.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : HUBS;

  const handleSignOut = useCallback(() => {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-3 pb-10 pt-1">
      {/* Page title */}
      <div className="px-1 pb-4 pt-5">
        <h1 className="text-[22px] font-bold text-neutral-900">Settings</h1>
        <p className="mt-0.5 text-sm text-stone-500">Manage your Rovvy experience</p>
      </div>

      {/* Search */}
      <SettingsSearchInput value={q} onChange={setQ} />

      {/* Hub grid */}
      <div className="mt-3 space-y-2.5">
        {filtered.map((hub) => (
          <SettingsHubCard key={hub.href} {...hub} />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-stone-400">No settings matching "{q}"</p>
        )}
      </div>

      {/* Sign out */}
      <div className="mt-8 border-t border-stone-100 pt-6">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-3.5 text-left text-red-600 transition-colors hover:bg-red-50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
            <LogOut size={18} className="text-red-500" />
          </div>
          <span className="text-[15px] font-medium">Sign out</span>
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] text-stone-400">Rovvy · Version 2.0</p>
    </div>
  );
}
