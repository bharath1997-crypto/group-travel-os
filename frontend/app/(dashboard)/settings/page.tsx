"use client";

import {
  Bell, Bot, Compass, Database,
  LogOut, Map, Plane, Search, Settings, ShieldCheck, Lock,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { SettingsHubCard, SettingsPageFooter, SettingsSearchInput } from "./_components";
import { SettingsBreadcrumb, CRUMBS_SETTINGS } from "@/components/settings/SettingsBreadcrumb";

const HUBS = [
  {
    href: "/settings/account-security",
    icon: ShieldCheck,
    iconBg: "#0F766E",
    title: "Account & Security",
    description: "Manage account access, devices, and security",
    count: 8,
    keywords: "password sign-in login 2fa two factor authentication devices sessions connected accounts verification status email change username security",
  },
  {
    href: "/settings/privacy-safety",
    icon: Lock,
    iconBg: "#1E40AF",
    title: "Privacy & Safety",
    description: "Control privacy, messaging, invites, and safety tools",
    count: 8,
    keywords: "blocked restricted users privacy account public private safety emergency contacts report hidden words message permissions trip invite",
  },
  {
    href: "/settings/trips-travel",
    icon: Plane,
    iconBg: "#7C3AED",
    title: "Trips & Travel",
    description: "Manage trip settings, travel preferences, and documents",
    count: 14,
    keywords: "trip invitations group permissions trusted travelers close friends travel preferences documents passport visa loyalty programs booking driver car vehicle fuel ev charging route road trip",
  },
  {
    href: "/settings/maps-trip-live",
    icon: Map,
    iconBg: "#065F46",
    title: "Maps & Trip LIVE",
    description: "Maps, Trip LIVE, navigation, and saved places",
    count: 9,
    badge: "New" as const,
    keywords: "maps saved places offline download navigation directions map appearance satellite trip live location sharing history privacy gps coordinate",
  },
  {
    href: "/settings/content-discovery",
    icon: Compass,
    iconBg: "#9A3412",
    title: "Content & Discovery",
    description: "Personalised discovery, recommendations, and avatars",
    count: 8,
    keywords: "travel interests events preferences ai recommendations discovery content filters hidden gems personalized feed avatar identity photo profile upload badges",
  },
  {
    href: "/settings/wayra-ai",
    icon: Bot,
    iconBg: "#4338CA",
    title: "Wayra AI",
    description: "AI personalization, memory, history, and data controls",
    count: 6,
    badge: "Beta" as const,
    keywords: "ai wayra assistant personalization memory history clear data controls generative artificial intelligence suggestions",
  },
  {
    href: "/settings/messages-notifications",
    icon: Bell,
    iconBg: "#B45309",
    title: "Messages & Notifications",
    description: "Control Lounge messages, alerts, and trip notifications",
    count: 7,
    keywords: "notifications alerts push email lounge messages chat group price alerts event alerts trips rovvy lounge message requests",
  },
  {
    href: "/settings/data-integrations",
    icon: Database,
    iconBg: "#0369A1",
    title: "Data & Integrations",
    description: "Export data, connect calendars, and manage integrations",
    count: 8,
    keywords: "download export data trips memories maps import google calendar apple icloud sync integration gdpr data portability archive",
  },
  {
    href: "/settings/app-preferences",
    icon: Settings,
    iconBg: "#374151",
    title: "App Preferences",
    description: "Language, currency, units, accessibility, and permissions",
    count: 8,
    keywords: "language locale currency units km miles celsius fahrenheit theme dark light accessibility permissions device camera microphone regional settings",
  },
  {
    href: "/settings/support-legal",
    icon: ShieldCheck,
    iconBg: "#BE185D",
    title: "Support & Legal",
    description: "Help, policies, legal documents, and account actions",
    count: 8,
    keywords: "help center contact support privacy policy terms of service cookie policy community guidelines delete account legal documents report streak",
  },
] as const;

export default function SettingsHubPage() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return HUBS;
    return HUBS.filter((h) =>
      `${h.title} ${h.description} ${h.keywords}`.toLowerCase().includes(needle),
    );
  }, [q]);

  const handleSignOut = useCallback(() => {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    window.location.href = "/explore";
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-3 pb-10 pt-1">
      <SettingsBreadcrumb crumbs={CRUMBS_SETTINGS} className="px-0 pt-3" />
      {/* Page title */}
      <div className="px-1 pb-4 pt-2">
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

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
              <Search size={24} className="text-stone-400" />
            </div>
            <p className="text-[15px] font-semibold text-neutral-900">No settings found</p>
            <p className="mt-1.5 max-w-xs text-sm text-stone-500">
              Try searching for{" "}
              {["password", "maps", "privacy", "notifications", "data"].map((kw, i, arr) => (
                <span key={kw}>
                  <button
                    type="button"
                    className="font-medium text-[#0F766E] underline underline-offset-2 hover:text-teal-700"
                    onClick={() => setQ(kw)}
                  >
                    {kw}
                  </button>
                  {i < arr.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="mt-8 border-t border-stone-100 pt-6">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-3.5 text-left text-red-600 transition-all duration-200 hover:border-red-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 transition-colors group-hover:bg-red-100">
            <LogOut size={18} className="text-red-500" />
          </div>
          <span className="text-[15px] font-medium">Sign out</span>
        </button>
      </div>

      <SettingsPageFooter />
    </div>
  );
}
