"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertOctagon,
  Asterisk,
  Bell,
  Bug,
  Check,
  ChevronLeft,
  Cloud,
  Database as DatabaseIcon,
  FileText,
  Folder,
  Globe2,
  Heart,
  HelpCircle,
  Info,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageSquareText,
  Moon as MoonIcon,
  Palette,
  PhoneCall,
  Plus,
  QrCode,
  Search,
  Share2,
  Shield,
  SmilePlus,
  Trash2,
  UserCircle2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DropThoughtControl } from "@/components/lounge/DropThoughtControl";
import { ProfileQrSheet } from "@/components/lounge/ProfileQrSheet";

export type ConnectSettingsUser = {
  id: string;
  email?: string | null;
  full_name: string | null;
  username?: string | null;
};

const INITIALS_AVATAR_COLORS = [
  "#E8385A",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)!;
  return Math.abs(h);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function listAvatarColor(name: string): string {
  return INITIALS_AVATAR_COLORS[hashString(name) % INITIALS_AVATAR_COLORS.length]!;
}

type ConnectScreen =
  | "main"
  | "account"
  | "privacy"
  | "chats"
  | "notifications"
  | "storage"
  | "lists"
  | "language"
  | "help"
  | "invite"
  | "blocked"
  | "delete-account";

type ConnectPrefs = {
  account: {
    security_notifications: boolean;
    two_step_pin_set: boolean;
  };
  privacy: {
    last_seen: "everyone" | "contacts" | "nobody";
    profile_picture: "everyone" | "contacts" | "nobody";
    about: "everyone" | "contacts" | "nobody";
    status: "everyone" | "contacts" | "nobody";
    groups: "everyone" | "contacts" | "nobody";
    avatar_stickers: "everyone" | "contacts" | "nobody";
    live_location: boolean;
    silence_unknown_callers: boolean;
    read_receipts: boolean;
    default_disappearing_seconds: number;
    app_lock: boolean;
    chat_lock: boolean;
    camera_effects: boolean;
    ip_protect_calls: boolean;
    disable_link_previews: boolean;
  };
  chats: {
    theme: "light" | "dark" | "system";
    wallpaper: string;
    enter_is_send: boolean;
    media_visibility: boolean;
    font_size: "small" | "medium" | "large";
    keep_archived: boolean;
  };
  notifications: {
    conversation_tones: boolean;
    reminders: boolean;
    notification_tone: string;
    vibrate: "off" | "default" | "short" | "long";
    light: string;
    high_priority: boolean;
    reaction_notifications: boolean;
    call_notifications: boolean;
  };
  storage: {
    use_less_data_for_calls: boolean;
    media_upload_quality: "standard" | "hd";
    auto_download_quality: string;
    auto_download_mobile: string[];
    auto_download_wifi: string[];
    auto_download_roaming: string[];
  };
  language: string;
};

const VISIBILITY_OPTIONS: { value: "everyone" | "contacts" | "nobody"; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "My contacts" },
  { value: "nobody", label: "Nobody" },
];

const DISAPPEARING_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "7 days" },
  { value: 7776000, label: "90 days" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", sub: "(device's language)" },
  { value: "es", label: "Español", sub: "Spanish" },
  { value: "pt-br", label: "Português (Brasil)", sub: "Portuguese (Brazil)" },
  { value: "ar", label: "العربية", sub: "Arabic" },
  { value: "zh-cn", label: "简体中文", sub: "Simplified Chinese" },
  { value: "fr", label: "Français", sub: "French" },
  { value: "ru", label: "Русский", sub: "Russian" },
  { value: "vi", label: "Tiếng Việt", sub: "Vietnamese" },
  { value: "ko", label: "한국어", sub: "Korean" },
  { value: "hi", label: "हिन्दी", sub: "Hindi" },
  { value: "te", label: "తెలుగు", sub: "Telugu" },
  { value: "ta", label: "தமிழ்", sub: "Tamil" },
];

const visibilityLabel = (v: string) =>
  VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? "Everyone";

const disappearingLabel = (n: number) =>
  DISAPPEARING_OPTIONS.find((o) => o.value === n)?.label ?? "Off";

export function ConnectSettingsPanel({
  user,
  onClose,
  onExit,
  showToast,
  onShareInvite,
  onLogout,
  variant = "fullscreen",
}: {
  user: ConnectSettingsUser | null;
  onClose: () => void;
  /** Full dismiss (e.g. close dock overlay before external navigation). */
  onExit?: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
  onShareInvite: () => Promise<void> | void;
  onLogout: () => void;
  variant?: "fullscreen" | "dock";
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<ConnectScreen>("main");
  const [prefs, setPrefs] = useState<ConnectPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showProfileQr, setShowProfileQr] = useState(false);

  // Load prefs from /settings/app
  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const data = await apiFetch<{
          preferences: { connect?: Partial<ConnectPrefs> };
        }>("/settings/app");
        const c = data.preferences?.connect ?? {};
        if (!cancel) {
          setPrefs({
            account: {
              security_notifications: c.account?.security_notifications ?? true,
              two_step_pin_set: c.account?.two_step_pin_set ?? false,
            },
            privacy: {
              last_seen: c.privacy?.last_seen ?? "everyone",
              profile_picture: c.privacy?.profile_picture ?? "everyone",
              about: c.privacy?.about ?? "everyone",
              status: c.privacy?.status ?? "contacts",
              groups: c.privacy?.groups ?? "everyone",
              avatar_stickers: c.privacy?.avatar_stickers ?? "contacts",
              live_location: c.privacy?.live_location ?? false,
              silence_unknown_callers: c.privacy?.silence_unknown_callers ?? false,
              read_receipts: c.privacy?.read_receipts ?? true,
              default_disappearing_seconds:
                c.privacy?.default_disappearing_seconds ?? 0,
              app_lock: c.privacy?.app_lock ?? false,
              chat_lock: c.privacy?.chat_lock ?? false,
              camera_effects: c.privacy?.camera_effects ?? true,
              ip_protect_calls: c.privacy?.ip_protect_calls ?? false,
              disable_link_previews: c.privacy?.disable_link_previews ?? false,
            },
            chats: {
              theme: c.chats?.theme ?? "system",
              wallpaper: c.chats?.wallpaper ?? "default",
              enter_is_send: c.chats?.enter_is_send ?? false,
              media_visibility: c.chats?.media_visibility ?? true,
              font_size: c.chats?.font_size ?? "medium",
              keep_archived: c.chats?.keep_archived ?? false,
            },
            notifications: {
              conversation_tones: c.notifications?.conversation_tones ?? true,
              reminders: c.notifications?.reminders ?? true,
              notification_tone: c.notifications?.notification_tone ?? "default",
              vibrate: c.notifications?.vibrate ?? "default",
              light: c.notifications?.light ?? "white",
              high_priority: c.notifications?.high_priority ?? true,
              reaction_notifications:
                c.notifications?.reaction_notifications ?? true,
              call_notifications: c.notifications?.call_notifications ?? true,
            },
            storage: {
              use_less_data_for_calls:
                c.storage?.use_less_data_for_calls ?? false,
              media_upload_quality: c.storage?.media_upload_quality ?? "hd",
              auto_download_quality:
                c.storage?.auto_download_quality ?? "auto",
              auto_download_mobile: c.storage?.auto_download_mobile ?? [
                "photos",
              ],
              auto_download_wifi: c.storage?.auto_download_wifi ?? [
                "photos",
                "audio",
                "video",
                "docs",
              ],
              auto_download_roaming: c.storage?.auto_download_roaming ?? [],
            },
            language: c.language ?? "en",
          });
        }
      } catch {
        if (!cancel) setPrefs(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Patch helper: deep-merge a partial connect.* tree
  const patchPref = useCallback(
    async (partial: Record<string, unknown>) => {
      if (saving) return;
      setSaving(true);
      try {
        await apiFetch("/settings/app", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: { connect: partial } }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not save";
        showToast(msg, "error");
      } finally {
        setSaving(false);
      }
    },
    [saving, showToast],
  );

  const updateAccount = (k: keyof ConnectPrefs["account"], v: boolean) => {
    setPrefs((p) =>
      p ? { ...p, account: { ...p.account, [k]: v } } : p,
    );
    void patchPref({ account: { [k]: v } });
  };
  const updatePrivacy = <K extends keyof ConnectPrefs["privacy"]>(
    k: K,
    v: ConnectPrefs["privacy"][K],
  ) => {
    setPrefs((p) =>
      p ? { ...p, privacy: { ...p.privacy, [k]: v } } : p,
    );
    void patchPref({ privacy: { [k]: v } });
  };
  const updateChats = <K extends keyof ConnectPrefs["chats"]>(
    k: K,
    v: ConnectPrefs["chats"][K],
  ) => {
    setPrefs((p) => (p ? { ...p, chats: { ...p.chats, [k]: v } } : p));
    void patchPref({ chats: { [k]: v } });
  };
  const updateNotifications = <K extends keyof ConnectPrefs["notifications"]>(
    k: K,
    v: ConnectPrefs["notifications"][K],
  ) => {
    setPrefs((p) =>
      p ? { ...p, notifications: { ...p.notifications, [k]: v } } : p,
    );
    void patchPref({ notifications: { [k]: v } });
  };
  const updateStorage = <K extends keyof ConnectPrefs["storage"]>(
    k: K,
    v: ConnectPrefs["storage"][K],
  ) => {
    setPrefs((p) =>
      p ? { ...p, storage: { ...p.storage, [k]: v } } : p,
    );
    void patchPref({ storage: { [k]: v } });
  };
  const updateLanguage = (v: string) => {
    setPrefs((p) => (p ? { ...p, language: v } : p));
    void patchPref({ language: v });
  };

  const goExternal = (href: string) => {
    (onExit ?? onClose)();
    router.push(href);
  };

  const isDock = variant === "dock";

  const headerTitle =
    screen === "main"
      ? "Settings"
      : screen === "account"
        ? "Account"
        : screen === "privacy"
          ? "Privacy"
          : screen === "chats"
            ? "Chats"
            : screen === "notifications"
              ? "Notifications"
              : screen === "storage"
                ? "Storage and data"
                : screen === "lists"
                  ? "Lists"
                  : screen === "language"
                    ? "App language"
                    : screen === "help"
                      ? "Help and feedback"
                      : screen === "invite"
                        ? "Invite a contact"
                        : screen === "blocked"
                          ? "Blocked contacts"
                          : screen === "delete-account"
                            ? "Delete account"
                            : "Settings";

  const headerBack = () => {
    if (screen === "main") onClose();
    else if (screen === "blocked" || screen === "delete-account")
      setScreen("account");
    else setScreen("main");
  };

  const displayName = (user?.full_name ?? "").trim() || "You";
  const initials = initialsFromName(displayName);
  const avBg = listAvatarColor(displayName);

  return (
    <div
      className={
        isDock
          ? "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
          : "fixed inset-0 z-[380] flex flex-col"
      }
      style={{ background: "#ffffff" }}
    >
      <header
        className={`flex shrink-0 items-center gap-2 border-b px-2 ${isDock ? "py-2" : "gap-3 px-3 py-3"}`}
        style={{ borderColor: "#e5e7eb", background: "#ffffff" }}
      >
        <button
          type="button"
          className={`flex items-center justify-center rounded-full hover:bg-black/5 ${isDock ? "h-8 w-8" : "h-9 w-9"}`}
          aria-label="Back"
          onClick={headerBack}
        >
          <ChevronLeft size={isDock ? 18 : 22} className="text-[#1e2a3a]" />
        </button>
        <h1
          className={`flex-1 font-bold ${isDock ? "text-sm" : "text-lg"}`}
          style={{ color: "#1e2a3a" }}
        >
          {headerTitle}
        </h1>
        {saving ? (
          <Loader2
            className="h-4 w-4 animate-spin"
            style={{ color: "#9ca3af" }}
            aria-label="Saving"
          />
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto" style={{ background: "#ffffff" }}>
        {loading && screen === "main" ? (
          <div className="flex justify-center py-16">
            <Loader2
              className="h-6 w-6 animate-spin"
              style={{ color: "#9ca3af" }}
            />
          </div>
        ) : null}

        {screen === "main" && !loading ? (
          <ConnectMainScreen
            search={search}
            setSearch={setSearch}
            user={user}
            displayName={displayName}
            initials={initials}
            avBg={avBg}
            showToast={showToast}
            onShareInvite={onShareInvite}
            goExternal={goExternal}
            setScreen={setScreen}
            onOpenProfileQr={() => setShowProfileQr(true)}
          />
        ) : null}

        {screen === "account" && prefs ? (
          <ConnectAccountScreen
            user={user}
            prefs={prefs.account}
            onChange={updateAccount}
            onOpenDelete={() => setScreen("delete-account")}
            onOpenBlocked={() => setScreen("blocked")}
            onLogout={onLogout}
            showToast={showToast}
          />
        ) : null}

        {screen === "privacy" && prefs ? (
          <ConnectPrivacyScreen
            prefs={prefs.privacy}
            onChange={updatePrivacy}
            onOpenBlocked={() => setScreen("blocked")}
            showToast={showToast}
          />
        ) : null}

        {screen === "chats" && prefs ? (
          <ConnectChatsScreen
            prefs={prefs.chats}
            onChange={updateChats}
            showToast={showToast}
          />
        ) : null}

        {screen === "notifications" && prefs ? (
          <ConnectNotificationsScreen
            prefs={prefs.notifications}
            onChange={updateNotifications}
          />
        ) : null}

        {screen === "storage" && prefs ? (
          <ConnectStorageScreen
            prefs={prefs.storage}
            onChange={updateStorage}
            showToast={showToast}
          />
        ) : null}

        {screen === "lists" ? <ConnectListsScreen showToast={showToast} /> : null}

        {screen === "language" && prefs ? (
          <ConnectLanguageScreen
            value={prefs.language}
            onChange={updateLanguage}
          />
        ) : null}

        {screen === "help" ? (
          <ConnectHelpScreen showToast={showToast} goExternal={goExternal} />
        ) : null}

        {screen === "invite" ? (
          <ConnectInviteScreen onShareInvite={onShareInvite} />
        ) : null}

        {screen === "blocked" ? (
          <ConnectBlockedScreen showToast={showToast} />
        ) : null}

        {screen === "delete-account" ? (
          <ConnectDeleteAccountScreen
            user={user}
            onCancel={() => setScreen("account")}
            onDeleted={() => {
              showToast("Account deleted", "success");
              onLogout();
            }}
          />
        ) : null}

        {screen === "main" ? (
          <p
            className="py-6 text-center text-xs"
            style={{ color: "#9ca3af" }}
          >
            from <span className="font-bold">Group Travel</span>
          </p>
        ) : null}
      </div>

      {showProfileQr && user?.id ? (
        <ProfileQrSheet
          variant={isDock ? "dock" : "fullscreen"}
          userId={user.id}
          displayName={displayName}
          username={user.username}
          initials={initials}
          avatarColor={avBg}
          onClose={() => setShowProfileQr(false)}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}

// ── Connect Settings sub-screens ──────────────────────────────────────────────

const SETTINGS_BG = "#ffffff";
const SETTINGS_HOVER = "rgba(0,0,0,0.03)";
const SETTINGS_SECTION_BG = "#f1f3f5";
const SETTINGS_BORDER = "#e5e7eb";
const SETTINGS_TEXT = "#1e2a3a";
const SETTINGS_MUTED = "#6b7280";
const SETTINGS_ACCENT = "#1d9e75";

function SettingsRow({
  icon,
  label,
  sublabel,
  trailing,
  onClick,
  destructive,
}: {
  icon?: ReactNode;
  label: string;
  sublabel?: string | ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-4 px-4 py-3 text-left ${onClick ? "hover:bg-black/[0.03]" : ""}`}
    >
      {icon ? (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ color: destructive ? "#dc2626" : SETTINGS_TEXT }}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[15px] font-semibold"
          style={{ color: destructive ? "#dc2626" : SETTINGS_TEXT }}
        >
          {label}
        </p>
        {sublabel ? (
          <div
            className="truncate text-xs"
            style={{ color: SETTINGS_MUTED }}
          >
            {sublabel}
          </div>
        ) : null}
      </div>
      {trailing ? (
        <div className="ml-2 flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </Tag>
  );
}

function SettingsToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "#1d2939" : "#d1d5db" }}
      onClick={onToggle}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
        style={{
          left: on ? "calc(100% - 22px)" : "2px",
          transition: "left 0.18s ease",
        }}
      />
    </button>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section>
      {title ? (
        <p
          className="px-4 pt-4 pb-1 text-xs"
          style={{ color: SETTINGS_MUTED }}
        >
          {title}
        </p>
      ) : (
        <div className="h-2" style={{ background: SETTINGS_SECTION_BG }} />
      )}
      <div style={{ background: SETTINGS_BG }}>{children}</div>
    </section>
  );
}

function ConnectMainScreen({
  search,
  setSearch,
  user,
  displayName,
  initials,
  avBg,
  showToast,
  onShareInvite,
  goExternal,
  setScreen,
  onOpenProfileQr,
}: {
  search: string;
  setSearch: (v: string) => void;
  user: ConnectSettingsUser | null;
  displayName: string;
  initials: string;
  avBg: string;
  showToast: (m: string, t?: "success" | "error") => void;
  onShareInvite: () => Promise<void> | void;
  goExternal: (href: string) => void;
  setScreen: (s: ConnectScreen) => void;
  onOpenProfileQr: () => void;
}) {
  type Row = {
    icon: ReactNode;
    label: string;
    sublabel?: string;
    onClick: () => void;
  };

  const sections: { rows: Row[] }[] = [
    {
      rows: [
        {
          icon: <UserCircle2 className="h-5 w-5" strokeWidth={1.5} />,
          label: "Account",
          sublabel: "Security notifications, change number",
          onClick: () => setScreen("account"),
        },
        {
          icon: <Lock className="h-5 w-5" strokeWidth={1.5} />,
          label: "Privacy",
          sublabel: "Blocked accounts, disappearing messages",
          onClick: () => setScreen("privacy"),
        },
        {
          icon: <SmilePlus className="h-5 w-5" strokeWidth={1.5} />,
          label: "Avatar",
          sublabel: "Create, edit, profile photo",
          onClick: () => goExternal("/settings/edit-profile"),
        },
        {
          icon: <UsersRound className="h-5 w-5" strokeWidth={1.5} />,
          label: "Lists",
          sublabel: "Manage people and groups",
          onClick: () => setScreen("lists"),
        },
      ],
    },
    {
      rows: [
        {
          icon: <MessageSquareText className="h-5 w-5" strokeWidth={1.5} />,
          label: "Chats",
          sublabel: "Theme, wallpapers, chat history",
          onClick: () => setScreen("chats"),
        },
        {
          icon: <Bell className="h-5 w-5" strokeWidth={1.5} />,
          label: "Notifications",
          sublabel: "Message, group & call tones",
          onClick: () => setScreen("notifications"),
        },
        {
          icon: <DatabaseIcon className="h-5 w-5" strokeWidth={1.5} />,
          label: "Storage and data",
          sublabel: "Network usage, auto-download",
          onClick: () => setScreen("storage"),
        },
        {
          icon: <Globe2 className="h-5 w-5" strokeWidth={1.5} />,
          label: "App language",
          sublabel: "English (device's language)",
          onClick: () => setScreen("language"),
        },
      ],
    },
    {
      rows: [
        {
          icon: <LifeBuoy className="h-5 w-5" strokeWidth={1.5} />,
          label: "Help and feedback",
          sublabel: "Help center, contact us, privacy policy",
          onClick: () => setScreen("help"),
        },
        {
          icon: <UserPlus className="h-5 w-5" strokeWidth={1.5} />,
          label: "Invite a contact",
          onClick: () => {
            setScreen("invite");
          },
        },
      ],
    },
  ];

  const filtered = (() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sections;
    return sections
      .map((s) => ({
        ...s,
        rows: s.rows.filter((r) =>
          `${r.label} ${r.sublabel ?? ""}`.toLowerCase().includes(needle),
        ),
      }))
      .filter((s) => s.rows.length > 0);
  })();

  const handleSignOut = useCallback(() => {
    const confirmed = window.confirm(
      "Are you sure you want to sign out?",
    );
    if (!confirmed) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    localStorage.removeItem("travello_user");
    window.location.href = "/login";
  }, []);

  return (
    <>
      <div className="px-3 py-3">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-2"
          style={{ background: SETTINGS_SECTION_BG }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
            style={{ color: SETTINGS_MUTED }}
          />
          <input
            type="text"
            placeholder="Search settings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: SETTINGS_TEXT }}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: "#d1d5db" }}
              onClick={() => setSearch("")}
            >
              <X className="h-3 w-3" style={{ color: SETTINGS_TEXT }} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white hover:opacity-90"
          style={{ background: avBg }}
          onClick={() => goExternal("/profile")}
          aria-label={`Open ${displayName} profile`}
        >
          {initials}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full truncate text-left text-base font-bold hover:opacity-80"
            style={{ color: SETTINGS_TEXT }}
            onClick={() => goExternal("/profile")}
          >
            {displayName}
          </button>
          {user?.id ? (
            <DropThoughtControl
              userId={user.id}
              userName={displayName}
              showToast={showToast}
            />
          ) : (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs"
              style={{ borderColor: SETTINGS_BORDER, color: "#374151" }}
            >
              <span aria-hidden>😊</span>
              Drop a thought
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Show QR code"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
          onClick={() => {
            if (!user?.id) {
              showToast("Sign in to share your profile", "error");
              return;
            }
            onOpenProfileQr();
          }}
        >
          <QrCode className="h-5 w-5" strokeWidth={1.5} style={{ color: SETTINGS_TEXT }} />
        </button>
      </div>

      {filtered.map((sec, idx) => (
        <SettingsSection key={idx}>
          {sec.rows.map((r) => (
            <SettingsRow
              key={r.label}
              icon={r.icon}
              label={r.label}
              sublabel={r.sublabel}
              onClick={r.onClick}
            />
          ))}
        </SettingsSection>
      ))}

      <div className="mt-4 border-t border-[#E9ECEF] pt-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[#E94560] transition-colors hover:bg-red-50"
        >
          <LogOut size={18} className="text-[#E94560]" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>

      <button
        type="button"
        className="mt-4 w-full px-4 py-3 text-left text-sm font-semibold"
        style={{ color: "#dc2626" }}
        onClick={() => {
          void onShareInvite();
        }}
      >
        Share Group Travel with a friend
      </button>
    </>
  );
}

function ConnectAccountScreen({
  user,
  prefs,
  onChange,
  onOpenDelete,
  onOpenBlocked: _onOpenBlocked,
  onLogout,
  showToast,
}: {
  user: ConnectSettingsUser | null;
  prefs: ConnectPrefs["account"];
  onChange: (k: keyof ConnectPrefs["account"], v: boolean) => void;
  onOpenDelete: () => void;
  onOpenBlocked: () => void;
  onLogout: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  return (
    <>
      <SettingsSection>
        <SettingsRow
          icon={<Shield className="h-5 w-5" strokeWidth={1.5} />}
          label="Security notifications"
          sublabel={
            prefs.security_notifications
              ? "On — alerts for new logins"
              : "Off"
          }
          trailing={
            <SettingsToggle
              on={prefs.security_notifications}
              onToggle={() =>
                onChange(
                  "security_notifications",
                  !prefs.security_notifications,
                )
              }
            />
          }
        />
        <SettingsRow
          icon={<KeyRound className="h-5 w-5" strokeWidth={1.5} />}
          label="Passkeys"
          sublabel="Sign in without a password"
          onClick={() => showToast("Passkeys coming soon", "success")}
        />
        <SettingsRow
          icon={<Mail className="h-5 w-5" strokeWidth={1.5} />}
          label="Email address"
          sublabel={user?.email ?? "—"}
          onClick={() => showToast("Email change coming soon", "success")}
        />
        <SettingsRow
          icon={<Asterisk className="h-5 w-5" strokeWidth={1.5} />}
          label="Two-step verification"
          sublabel={prefs.two_step_pin_set ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              on={prefs.two_step_pin_set}
              onToggle={() =>
                onChange("two_step_pin_set", !prefs.two_step_pin_set)
              }
            />
          }
        />
        <SettingsRow
          icon={<PhoneCall className="h-5 w-5" strokeWidth={1.5} />}
          label="Change phone number"
          onClick={() => showToast("Phone change coming soon", "success")}
        />
        <SettingsRow
          icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
          label="Request account info"
          onClick={() => showToast("Data export coming soon", "success")}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          icon={<LogOut className="h-5 w-5" strokeWidth={1.5} />}
          label="Log out"
          onClick={() => {
            if (window.confirm("Log out of Group Travel?")) onLogout();
          }}
        />
        <SettingsRow
          icon={<Trash2 className="h-5 w-5" strokeWidth={1.5} />}
          label="Delete account"
          destructive
          onClick={onOpenDelete}
        />
      </SettingsSection>
    </>
  );
}

function VisibilityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "everyone" | "contacts" | "nobody";
  onChange: (v: "everyone" | "contacts" | "nobody") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        label={label}
        sublabel={visibilityLabel(value)}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="px-3 py-2 text-xs"
              style={{ color: SETTINGS_MUTED }}
            >
              {label}
            </p>
            {VISIBILITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm hover:bg-black/[0.03]"
                style={{ color: SETTINGS_TEXT }}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
                {value === o.value ? (
                  <Check
                    className="h-4 w-4"
                    style={{ color: SETTINGS_ACCENT }}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConnectPrivacyScreen({
  prefs,
  onChange,
  onOpenBlocked,
  showToast,
}: {
  prefs: ConnectPrefs["privacy"];
  onChange: <K extends keyof ConnectPrefs["privacy"]>(
    k: K,
    v: ConnectPrefs["privacy"][K],
  ) => void;
  onOpenBlocked: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [timerOpen, setTimerOpen] = useState(false);
  return (
    <>
      <SettingsSection title="Who can see my personal info">
        <VisibilityRow
          label="Last seen and online"
          value={prefs.last_seen}
          onChange={(v) => onChange("last_seen", v)}
        />
        <VisibilityRow
          label="Profile picture"
          value={prefs.profile_picture}
          onChange={(v) => onChange("profile_picture", v)}
        />
        <VisibilityRow
          label="About"
          value={prefs.about}
          onChange={(v) => onChange("about", v)}
        />
        <VisibilityRow
          label="Status"
          value={prefs.status}
          onChange={(v) => onChange("status", v)}
        />
        <SettingsRow
          label="Read receipts"
          sublabel="If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats."
          trailing={
            <SettingsToggle
              on={prefs.read_receipts}
              onToggle={() => onChange("read_receipts", !prefs.read_receipts)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Disappearing messages">
        <SettingsRow
          label="Default message timer"
          sublabel="Start new chats with disappearing messages set to your timer"
          trailing={
            <span className="text-sm" style={{ color: SETTINGS_MUTED }}>
              {disappearingLabel(prefs.default_disappearing_seconds)}
            </span>
          }
          onClick={() => setTimerOpen(true)}
        />
        {timerOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setTimerOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {DISAPPEARING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("default_disappearing_seconds", o.value);
                    setTimerOpen(false);
                  }}
                >
                  {o.label}
                  {prefs.default_disappearing_seconds === o.value ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection>
        <VisibilityRow
          label="Groups"
          value={prefs.groups}
          onChange={(v) => onChange("groups", v)}
        />
        <VisibilityRow
          label="Avatar stickers"
          value={prefs.avatar_stickers}
          onChange={(v) => onChange("avatar_stickers", v)}
        />
        <SettingsRow
          label="Live location"
          sublabel={prefs.live_location ? "Sharing enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              on={prefs.live_location}
              onToggle={() => onChange("live_location", !prefs.live_location)}
            />
          }
        />
        <SettingsRow
          label="Calls"
          sublabel="Silence unknown callers"
          trailing={
            <SettingsToggle
              on={prefs.silence_unknown_callers}
              onToggle={() =>
                onChange(
                  "silence_unknown_callers",
                  !prefs.silence_unknown_callers,
                )
              }
            />
          }
        />
        <SettingsRow
          label="Contacts"
          sublabel="Blocked accounts"
          onClick={onOpenBlocked}
        />
        <SettingsRow
          label="App lock"
          sublabel={prefs.app_lock ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              on={prefs.app_lock}
              onToggle={() => onChange("app_lock", !prefs.app_lock)}
            />
          }
        />
        <SettingsRow
          label="Chat lock"
          trailing={
            <SettingsToggle
              on={prefs.chat_lock}
              onToggle={() => onChange("chat_lock", !prefs.chat_lock)}
            />
          }
        />
        <SettingsRow
          label="Allow camera effects"
          sublabel="Use effects in the camera and video calls"
          trailing={
            <SettingsToggle
              on={prefs.camera_effects}
              onToggle={() => onChange("camera_effects", !prefs.camera_effects)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Advanced">
        <SettingsRow
          label="Protect IP address in calls"
          trailing={
            <SettingsToggle
              on={prefs.ip_protect_calls}
              onToggle={() =>
                onChange("ip_protect_calls", !prefs.ip_protect_calls)
              }
            />
          }
        />
        <SettingsRow
          label="Disable link previews"
          trailing={
            <SettingsToggle
              on={prefs.disable_link_previews}
              onToggle={() =>
                onChange("disable_link_previews", !prefs.disable_link_previews)
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label="Privacy checkup"
          sublabel="Control your privacy and choose the right settings for you."
          onClick={() =>
            showToast("Privacy checkup coming soon", "success")
          }
        />
      </SettingsSection>
    </>
  );
}

function ConnectChatsScreen({
  prefs,
  onChange,
  showToast,
}: {
  prefs: ConnectPrefs["chats"];
  onChange: <K extends keyof ConnectPrefs["chats"]>(
    k: K,
    v: ConnectPrefs["chats"][K],
  ) => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  return (
    <>
      <SettingsSection title="Display">
        <SettingsRow
          icon={<MoonIcon className="h-5 w-5" strokeWidth={1.5} />}
          label="Theme"
          sublabel={
            prefs.theme === "system"
              ? "System default"
              : prefs.theme === "light"
                ? "Light"
                : "Dark"
          }
          onClick={() => setThemeOpen(true)}
        />
        <SettingsRow
          icon={<Palette className="h-5 w-5" strokeWidth={1.5} />}
          label="Default chat theme"
          onClick={() => showToast("Wallpapers coming soon", "success")}
        />
        {themeOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setThemeOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("theme", t);
                    setThemeOpen(false);
                  }}
                >
                  {t === "system"
                    ? "System default"
                    : t === "light"
                      ? "Light"
                      : "Dark"}
                  {prefs.theme === t ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Chat settings">
        <SettingsRow
          label="Enter is send"
          sublabel="Enter key will send your message"
          trailing={
            <SettingsToggle
              on={prefs.enter_is_send}
              onToggle={() => onChange("enter_is_send", !prefs.enter_is_send)}
            />
          }
        />
        <SettingsRow
          label="Media visibility"
          sublabel="Show newly downloaded media in your device's gallery"
          trailing={
            <SettingsToggle
              on={prefs.media_visibility}
              onToggle={() =>
                onChange("media_visibility", !prefs.media_visibility)
              }
            />
          }
        />
        <SettingsRow
          label="Font size"
          sublabel={
            prefs.font_size === "small"
              ? "Small"
              : prefs.font_size === "large"
                ? "Large"
                : "Medium"
          }
          onClick={() => setFontOpen(true)}
        />
        {fontOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setFontOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["small", "medium", "large"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("font_size", f);
                    setFontOpen(false);
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {prefs.font_size === f ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Archived chats">
        <SettingsRow
          label="Keep chats archived"
          sublabel="Archived chats will remain archived when you receive a new message"
          trailing={
            <SettingsToggle
              on={prefs.keep_archived}
              onToggle={() => onChange("keep_archived", !prefs.keep_archived)}
            />
          }
        />
        <SettingsRow
          icon={<Cloud className="h-5 w-5" strokeWidth={1.5} />}
          label="Chat backup"
          onClick={() => showToast("Chat backup coming soon", "success")}
        />
      </SettingsSection>
    </>
  );
}

function ConnectNotificationsScreen({
  prefs,
  onChange,
}: {
  prefs: ConnectPrefs["notifications"];
  onChange: <K extends keyof ConnectPrefs["notifications"]>(
    k: K,
    v: ConnectPrefs["notifications"][K],
  ) => void;
}) {
  const [vibrateOpen, setVibrateOpen] = useState(false);
  return (
    <>
      <SettingsSection>
        <SettingsRow
          label="Conversation tones"
          sublabel="Play sounds for incoming and outgoing messages."
          trailing={
            <SettingsToggle
              on={prefs.conversation_tones}
              onToggle={() =>
                onChange("conversation_tones", !prefs.conversation_tones)
              }
            />
          }
        />
        <SettingsRow
          label="Reminders"
          sublabel="Get occasional reminders about messages or status updates you haven't seen"
          trailing={
            <SettingsToggle
              on={prefs.reminders}
              onToggle={() => onChange("reminders", !prefs.reminders)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Messages">
        <SettingsRow
          label="Notification tone"
          sublabel={prefs.notification_tone || "Default"}
          onClick={() => onChange("notification_tone", "default")}
        />
        <SettingsRow
          label="Vibrate"
          sublabel={
            prefs.vibrate.charAt(0).toUpperCase() + prefs.vibrate.slice(1)
          }
          onClick={() => setVibrateOpen(true)}
        />
        {vibrateOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setVibrateOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["off", "default", "short", "long"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("vibrate", v);
                    setVibrateOpen(false);
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                  {prefs.vibrate === v ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <SettingsRow
          label="Light"
          sublabel={prefs.light}
          onClick={() => onChange("light", "white")}
        />
        <SettingsRow
          label="Use high priority notifications"
          sublabel="Show previews of notifications at the top of the screen"
          trailing={
            <SettingsToggle
              on={prefs.high_priority}
              onToggle={() => onChange("high_priority", !prefs.high_priority)}
            />
          }
        />
        <SettingsRow
          label="Reaction notifications"
          sublabel="Show notifications for reactions to messages you send"
          trailing={
            <SettingsToggle
              on={prefs.reaction_notifications}
              onToggle={() =>
                onChange(
                  "reaction_notifications",
                  !prefs.reaction_notifications,
                )
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Calls">
        <SettingsRow
          label="Call notifications"
          trailing={
            <SettingsToggle
              on={prefs.call_notifications}
              onToggle={() =>
                onChange("call_notifications", !prefs.call_notifications)
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}

function ConnectStorageScreen({
  prefs,
  onChange,
  showToast,
}: {
  prefs: ConnectPrefs["storage"];
  onChange: <K extends keyof ConnectPrefs["storage"]>(
    k: K,
    v: ConnectPrefs["storage"][K],
  ) => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  return (
    <>
      <SettingsSection>
        <SettingsRow
          icon={<Folder className="h-5 w-5" strokeWidth={1.5} />}
          label="Manage storage"
          sublabel="Calculating…"
          onClick={() => showToast("Storage manager coming soon", "success")}
        />
        <SettingsRow
          icon={<Activity className="h-5 w-5" strokeWidth={1.5} />}
          label="Network usage"
          sublabel="Track sent / received"
          onClick={() => showToast("Network usage coming soon", "success")}
        />
        <SettingsRow
          label="Use less data for calls"
          trailing={
            <SettingsToggle
              on={prefs.use_less_data_for_calls}
              onToggle={() =>
                onChange(
                  "use_less_data_for_calls",
                  !prefs.use_less_data_for_calls,
                )
              }
            />
          }
        />
        <SettingsRow
          label="Proxy"
          sublabel="Off"
          onClick={() => showToast("Proxy not supported on web", "success")}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label="Media upload quality"
          sublabel={prefs.media_upload_quality === "hd" ? "HD quality" : "Standard"}
          onClick={() => setUploadOpen(true)}
        />
        {uploadOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setUploadOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["standard", "hd"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("media_upload_quality", q);
                    setUploadOpen(false);
                  }}
                >
                  {q === "hd" ? "HD quality" : "Standard"}
                  {prefs.media_upload_quality === q ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <SettingsRow
          label="Auto-download quality"
          sublabel={prefs.auto_download_quality}
          onClick={() => onChange("auto_download_quality", "auto")}
        />
      </SettingsSection>

      <SettingsSection title="Media auto-download">
        <SettingsRow
          label="When using mobile data"
          sublabel={prefs.auto_download_mobile.join(", ") || "No media"}
        />
        <SettingsRow
          label="When connected on Wi-Fi"
          sublabel={prefs.auto_download_wifi.join(", ") || "No media"}
        />
        <SettingsRow
          label="When roaming"
          sublabel={prefs.auto_download_roaming.join(", ") || "No media"}
        />
      </SettingsSection>
    </>
  );
}

function ConnectListsScreen({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  return (
    <>
      <div className="px-6 pt-6 text-center">
        <p
          className="text-sm"
          style={{ color: SETTINGS_MUTED }}
        >
          Focus on who matters most. Easily send and share across Connect.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: SETTINGS_SECTION_BG, color: SETTINGS_TEXT }}
          onClick={() => showToast("Custom lists coming soon", "success")}
        >
          <Plus className="h-4 w-4" />
          Create a custom list
        </button>
      </div>
      <SettingsSection title="Your lists">
        <SettingsRow
          icon={<MessageSquareText className="h-5 w-5" strokeWidth={1.5} />}
          label="Unread"
          sublabel="Preset"
          onClick={() => showToast("Filter by unread in chats", "success")}
        />
        <SettingsRow
          icon={<Heart className="h-5 w-5" strokeWidth={1.5} />}
          label="Favorites"
          sublabel="Preset"
          onClick={() => showToast("Filter by favorites in chats", "success")}
        />
        <SettingsRow
          icon={<UsersRound className="h-5 w-5" strokeWidth={1.5} />}
          label="Groups"
          sublabel="Preset"
          onClick={() => showToast("Switch to Groups tab", "success")}
        />
      </SettingsSection>
    </>
  );
}

function ConnectLanguageScreen({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SettingsSection>
      {LANGUAGE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03]"
          onClick={() => onChange(o.value)}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: value === o.value ? "#1d2939" : "#9ca3af",
              background: value === o.value ? "#1d2939" : "transparent",
            }}
          >
            {value === o.value ? (
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[15px]"
              style={{ color: SETTINGS_TEXT }}
            >
              {o.label}
            </p>
            <p className="truncate text-xs" style={{ color: SETTINGS_MUTED }}>
              {o.sub}
            </p>
          </div>
        </button>
      ))}
    </SettingsSection>
  );
}

function ConnectHelpScreen({
  showToast,
  goExternal,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
  goExternal: (href: string) => void;
}) {
  return (
    <SettingsSection>
      <SettingsRow
        icon={<HelpCircle className="h-5 w-5" strokeWidth={1.5} />}
        label="Help center"
        sublabel="Get help, contact us"
        onClick={() => goExternal("/settings/support")}
      />
      <SettingsRow
        icon={<Bug className="h-5 w-5" strokeWidth={1.5} />}
        label="Send feedback"
        sublabel="Report technical issues"
        onClick={() => goExternal("/settings/support#bugs")}
      />
      <SettingsRow
        icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
        label="Terms"
        onClick={() => goExternal("/settings/support#terms")}
      />
      <SettingsRow
        icon={<AlertOctagon className="h-5 w-5" strokeWidth={1.5} />}
        label="Channel reports"
        onClick={() => showToast("No reports", "success")}
      />
      <SettingsRow
        icon={<Info className="h-5 w-5" strokeWidth={1.5} />}
        label="App info"
        sublabel="Group Travel"
        onClick={() => showToast("Group Travel · web", "success")}
      />
    </SettingsSection>
  );
}

function ConnectInviteScreen({
  onShareInvite,
}: {
  onShareInvite: () => Promise<void> | void;
}) {
  return (
    <>
      <SettingsSection>
        <SettingsRow
          icon={
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "#1d2939" }}
            >
              <Share2 className="h-4 w-4 text-white" strokeWidth={1.8} />
            </span>
          }
          label="Share link"
          onClick={() => {
            void onShareInvite();
          }}
        />
      </SettingsSection>
      <p
        className="px-4 pt-4 text-xs"
        style={{ color: SETTINGS_MUTED }}
      >
        We'll soon let you invite contacts directly from your address book.
      </p>
    </>
  );
}

function ConnectBlockedScreen({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [items, setItems] = useState<
    { id: string; full_name: string; avatar_url: string | null }[] | null
  >(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<
        { id: string; full_name: string; avatar_url: string | null }[]
      >("/social/blocked");
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (id: string) => {
    if (!window.confirm("Unblock this user?")) return;
    try {
      await apiFetch(`/social/block/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      showToast("User unblocked", "success");
      await load();
    } catch {
      showToast("Could not unblock", "error");
    }
  };

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#9ca3af" }} />
        </div>
      ) : items && items.length > 0 ? (
        <SettingsSection>
          {items.map((it) => (
            <SettingsRow
              key={it.id}
              icon={
                it.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: listAvatarColor(it.full_name) }}
                  >
                    {initialsFromName(it.full_name)}
                  </span>
                )
              }
              label={it.full_name}
              trailing={
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-semibold"
                  style={{ color: SETTINGS_ACCENT }}
                  onClick={() => void unblock(it.id)}
                >
                  Unblock
                </button>
              }
            />
          ))}
        </SettingsSection>
      ) : (
        <p className="px-6 py-10 text-center text-sm" style={{ color: SETTINGS_MUTED }}>
          You haven't blocked anyone.
        </p>
      )}
    </>
  );
}

function ConnectDeleteAccountScreen({
  user,
  onCancel,
  onDeleted,
}: {
  user: ConnectSettingsUser | null;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userEmail = user?.email ?? "";

  const submit = async () => {
    if (confirmation !== "DELETE") {
      setError('Type DELETE in the confirmation field');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/account/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, password: password || null }),
      });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <p className="text-sm" style={{ color: SETTINGS_TEXT }}>
        Deleting your account will:
      </p>
      <ul
        className="ml-5 mt-2 list-disc text-sm"
        style={{ color: SETTINGS_MUTED }}
      >
        <li>Permanently remove your messages, groups and trips</li>
        <li>Cancel any active subscriptions</li>
        <li>Erase your profile from search and friend lists</li>
      </ul>

      <p
        className="mt-5 text-xs font-semibold uppercase"
        style={{ color: SETTINGS_MUTED }}
      >
        Confirm
      </p>
      <input
        type="text"
        placeholder="Type DELETE to confirm"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: SETTINGS_BORDER, color: SETTINGS_TEXT }}
      />

      {userEmail ? (
        <>
          <p
            className="mt-4 text-xs font-semibold uppercase"
            style={{ color: SETTINGS_MUTED }}
          >
            Password (leave empty for OAuth-only accounts)
          </p>
          <input
            type="password"
            placeholder="Your account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: SETTINGS_BORDER, color: SETTINGS_TEXT }}
          />
        </>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm" style={{ color: "#dc2626" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-lg border py-2.5 text-sm font-semibold"
          style={{ borderColor: SETTINGS_BORDER, color: SETTINGS_TEXT }}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#dc2626" }}
          onClick={() => void submit()}
          disabled={submitting || confirmation !== "DELETE"}
        >
          {submitting ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </div>
  );
}
