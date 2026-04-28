"use client";

import {
  Accessibility,
  Activity,
  AlertCircle,
  Archive,
  AtSign,
  Ban,
  BarChart3,
  Bell,
  BellOff,
  Bookmark,
  Clock,
  Crown,
  Download,
  Eye,
  FileText,
  Grid3x3,
  HeartCrack,
  Image as ImageIcon,
  Languages,
  LifeBuoy,
  Lock,
  MessageCircle,
  MessageSquare,
  Scale,
  Share2,
  Shield,
  ShieldOff,
  Smartphone,
  Star,
  Tablet,
  Tv,
  Type,
  UserCircle2,
  UserPlus,
  UserX,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchAppSettings,
  type AppSettingsBundle,
  type SettingsCounts,
} from "@/lib/app-settings";
import { API_BASE } from "@/lib/api";
import {
  SettingsLinkRow,
  SettingsSearchInput,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "./_components";
import type { LucideIcon } from "lucide-react";

type HubItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  sublabel?: string;
  countKey?: keyof SettingsCounts;
  keywords?: string;
};

type HubSection = { title: string; items: HubItem[] };

const HUB: HubSection[] = [
  {
    title: "Your account",
    items: [
      {
        label: "Accounts center",
        sublabel:
          "Password, security, personal details, connected experiences, preferences",
        href: "/settings/account",
        icon: UserCircle2,
        keywords: "meta accounts center password",
      },
    ],
  },
  {
    title: "General account",
    items: [
      {
        label: "Close friends",
        href: "/settings/general#close-friends",
        icon: Star,
        countKey: "close_friends",
        keywords: "favorite inner circle",
      },
      {
        label: "Crossposting",
        href: "/settings/general#crosspost",
        icon: Grid3x3,
        keywords: "share external",
      },
      {
        label: "Blocked",
        href: "/settings/blocked",
        icon: Ban,
        countKey: "blocked",
        keywords: "block list",
      },
      {
        label: "Story, live and location",
        href: "/settings/general#story-location",
        icon: ShieldOff,
        keywords: "privacy location stories",
      },
      {
        label: "Activity in Friends tab",
        href: "/settings/general#activity-friends",
        icon: UsersRound,
        keywords: "friends activity",
      },
    ],
  },
  {
    title: "How others interact with you",
    items: [
      {
        label: "Messages and story replies",
        href: "/settings/interactions#messages",
        icon: MessageCircle,
        keywords: "dm chat replies",
      },
      {
        label: "Tags and mentions",
        href: "/settings/interactions#tags",
        icon: AtSign,
        keywords: "mention tag",
      },
      {
        label: "Comments",
        href: "/settings/interactions#comments",
        icon: MessageSquare,
        keywords: "comment moderation",
      },
      {
        label: "Sharing",
        href: "/settings/interactions#sharing",
        icon: Share2,
        keywords: "reshare repost",
      },
      {
        label: "Restricted",
        href: "/settings/interactions#restricted",
        icon: UserX,
        countKey: "restricted",
        keywords: "restrict limited",
      },
      {
        label: "Limit interactions",
        href: "/settings/interactions#limit",
        icon: AlertCircle,
        keywords: "spam limit",
      },
      {
        label: "Hidden words",
        href: "/settings/interactions#hidden",
        icon: Type,
        keywords: "filter moderation",
      },
    ],
  },
  {
    title: "How you use Group Travel",
    items: [
      {
        label: "Saved",
        href: "/explore",
        icon: Bookmark,
        keywords: "bookmarks trips pins",
      },
      {
        label: "Archive",
        href: "/settings/usage#archive",
        icon: Archive,
        keywords: "history archive",
      },
      {
        label: "Your activity",
        href: "/settings/usage#activity",
        icon: Activity,
        keywords: "history stats",
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        keywords: "alerts push email",
      },
      {
        label: "Time management",
        href: "/settings/usage#time",
        icon: Clock,
        keywords: "reminders screen time",
      },
      {
        label: "Group Travel for tablets",
        href: "/settings/usage#tablet",
        icon: Tablet,
        keywords: "ipad layout",
      },
      {
        label: "Group Travel for TV",
        href: "/settings/usage#tv",
        icon: Tv,
        keywords: "cast television",
      },
    ],
  },
  {
    title: "Who can see your content",
    items: [
      {
        label: "Account privacy",
        href: "/settings/edit-profile",
        icon: Lock,
        keywords: "private public profile",
      },
      {
        label: "Follow and invite friends",
        href: "/travel-hub",
        icon: UserPlus,
        keywords: "invite connect",
      },
    ],
  },
  {
    title: "What you see",
    items: [
      {
        label: "Favorites",
        href: "/settings/content#favorites",
        icon: Star,
        countKey: "favorites",
        keywords: "favorite people",
      },
      {
        label: "Muted accounts",
        href: "/settings/content#muted",
        icon: BellOff,
        countKey: "muted",
        keywords: "mute silence",
      },
      {
        label: "Content preferences",
        href: "/settings/content#preferences",
        icon: ImageIcon,
        keywords: "algorithm feed",
      },
      {
        label: "Like and share counts",
        href: "/settings/content#counts",
        icon: HeartCrack,
        keywords: "hide counts vanity",
      },
      {
        label: "Creator subscriptions",
        href: "/settings/content#creators",
        icon: Crown,
        keywords: "premium creators",
      },
    ],
  },
  {
    title: "Your app and media",
    items: [
      {
        label: "Device permissions",
        href: "/settings/app-media#permissions",
        icon: Smartphone,
        keywords: "camera microphone location",
      },
      {
        label: "Archiving and downloading",
        href: "/settings/app-media#archiving",
        icon: Download,
        keywords: "export backup",
      },
      {
        label: "Accessibility",
        href: "/settings/app-media#accessibility",
        icon: Accessibility,
        keywords: "a11y large text",
      },
      {
        label: "Language and translations",
        href: "/settings/app-media#language",
        icon: Languages,
        keywords: "locale i18n",
      },
      {
        label: "Data usage and media quality",
        href: "/settings/app-media#data",
        icon: BarChart3,
        keywords: "wifi cellular quality",
      },
    ],
  },
  {
    title: "Support and information",
    items: [
      {
        label: "Travel streak help",
        href: "/settings/support#streak",
        icon: LifeBuoy,
        keywords: "lost streak snap",
      },
      {
        label: "Bugs and suggestions",
        href: "/settings/support#bugs",
        icon: MessageSquare,
        keywords: "feedback report",
      },
      {
        label: "Safety and privacy overview",
        href: "/settings/support#safety",
        icon: Shield,
        keywords: "trust safety",
      },
      {
        label: "Help center",
        href: "/settings/support#help",
        icon: LifeBuoy,
        keywords: "faq support",
      },
      {
        label: "Privacy policy",
        href: "/settings/support#privacy",
        icon: FileText,
        keywords: "legal",
      },
      {
        label: "Terms of service",
        href: "/settings/support#terms",
        icon: Scale,
        keywords: "legal",
      },
      {
        label: "Regional privacy choices",
        href: "/settings/support#regional-privacy",
        icon: Eye,
        keywords: "california florida ccpa",
      },
      {
        label: "My data",
        href: "/settings/support#my-data",
        icon: Download,
        keywords: "export gdpr",
      },
    ],
  },
  {
    title: "Security & account actions",
    items: [
      {
        label: "Password & sign-in",
        href: "/settings/security#password",
        icon: Lock,
        keywords: "password 2fa session",
      },
    ],
  },
];

export default function SettingsHubPage() {
  const [q, setQ] = useState("");
  const [bundle, setBundle] = useState<AppSettingsBundle | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setBundle(await fetchAppSettings());
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const privacyLabel = useMemo(() => {
    if (!bundle?.account) return "—";
    return bundle.account.profile_public ? "Public" : "Private";
  }, [bundle]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return HUB;
    return HUB.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => {
        const hay = `${it.label} ${it.sublabel ?? ""} ${it.keywords ?? ""}`.toLowerCase();
        return hay.includes(needle);
      }),
    })).filter((sec) => sec.items.length > 0);
  }, [q]);

  return (
    <>
      <SettingsScreenHeader title="Settings and activity" backHref="/dashboard" />
      <SettingsSearchInput value={q} onChange={setQ} />
      {loadErr ? (
        <div className="mx-3 mt-2 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
          <p className="whitespace-pre-wrap leading-snug">{loadErr}</p>
          <p className="mt-2 font-mono text-[11px] text-red-800/90">
            NEXT_PUBLIC_API_URL → {API_BASE}
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}
      {!bundle && !loadErr ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      ) : null}

      {bundle
        ? filtered.map((sec) => (
            <section key={sec.title}>
              <SettingsSectionTitle>{sec.title}</SettingsSectionTitle>
              <div className="bg-white">
                {sec.items.map((it) => {
                  const count =
                    it.countKey != null ? bundle.counts[it.countKey] : undefined;
                  const sub =
                    it.label === "Account privacy" ? privacyLabel : it.sublabel;
                  return (
                    <SettingsLinkRow
                      key={it.label + it.href}
                      href={it.href}
                      icon={it.icon}
                      label={it.label}
                      sublabel={sub}
                      trailing={
                        count != null && count > 0 ? (
                          <span className="text-sm text-stone-500">{count}</span>
                        ) : it.label === "Limit interactions" ? (
                          <span className="text-sm text-stone-500">
                            {Boolean(
                              (
                                bundle.preferences.interactions as
                                  | { limit_interactions?: boolean }
                                  | undefined
                              )?.limit_interactions,
                            )
                              ? "On"
                              : "Off"}
                          </span>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))
        : null}
    </>
  );
}
