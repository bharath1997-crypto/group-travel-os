"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Luggage,
  Map,
  MapPin,
  Search,
  Shield,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import {
  SettingsBreadcrumb,
  nestedCrumbs,
} from "@/components/settings/SettingsBreadcrumb";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface PrivacyState {
  profile_public: boolean;
}

// ─────────────────────────────────────────────
// Animated toggle (iOS-style)
// ─────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
  loading,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && !loading && onChange(!checked)}
      disabled={disabled || loading}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-teal-500 ${
        checked
          ? "bg-teal-500"
          : "bg-stone-200"
      } ${disabled || loading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      {loading ? (
        /* Spinner overlay */
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </span>
      ) : (
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// Live toggle row (connects to backend)
// ─────────────────────────────────────────────
function LiveToggleRow({
  icon: Icon,
  label,
  sublabel,
  checked,
  onChange,
  loading,
  error,
  last,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
  error?: string;
  last?: boolean;
}) {
  const toggleId = `toggle-${label.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <div className={`px-4 py-3.5 ${last ? "" : "border-b border-stone-100"}`}>
      <div className="flex items-center gap-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
          <Icon size={16} strokeWidth={1.8} className="text-blue-700" />
        </div>
        <label htmlFor={toggleId} className="min-w-0 flex-1 cursor-pointer">
          <p className="text-[14px] font-medium text-neutral-900">{label}</p>
          <p className="mt-0.5 text-xs text-stone-400">{sublabel}</p>
        </label>
        <Toggle
          id={toggleId}
          checked={checked}
          onChange={onChange}
          loading={loading}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 pl-11 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Visibility selector (3-option segmented pill)
// ─────────────────────────────────────────────
type VisValue = "everyone" | "buddies" | "only_me";

const VIS_OPTIONS: { value: VisValue; label: string; icon: React.ElementType }[] = [
  { value: "everyone", label: "Everyone",  icon: Globe    },
  { value: "buddies",  label: "Buddies",   icon: Users    },
  { value: "only_me",  label: "Only Me",   icon: Lock     },
];

function VisSelector({
  value,
  onChange,
  disabled,
}: {
  value: VisValue;
  onChange: (v: VisValue) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex rounded-xl border border-stone-200 bg-stone-50 p-0.5 ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
      role="radiogroup"
    >
      {VIS_OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            disabled={disabled}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              active
                ? "bg-white text-teal-700 shadow-sm"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <Icon size={11} strokeWidth={2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Coming-soon visibility row
// ─────────────────────────────────────────────
function VisRow({
  icon: Icon,
  label,
  sublabel,
  last,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  last?: boolean;
}) {
  return (
    <div
      className={`cursor-default select-none px-4 py-3.5 opacity-75 pointer-events-none ${
        last ? "" : "border-b border-stone-100"
      }`}
      aria-disabled="true"
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
          <Icon size={16} strokeWidth={1.8} className="text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium text-neutral-900/80">{label}</p>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              Coming Soon
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-400/80">{sublabel}</p>
        </div>
      </div>
      <div className="mt-2.5 pl-11">
        <VisSelector value="everyone" onChange={() => {}} disabled />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Coming-soon toggle row
// ─────────────────────────────────────────────
function DisabledToggleRow({
  icon: Icon,
  label,
  sublabel,
  last,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex cursor-default select-none items-center gap-3.5 px-4 py-3.5 opacity-75 pointer-events-none ${
        last ? "" : "border-b border-stone-100"
      }`}
      aria-disabled="true"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
        <Icon size={16} strokeWidth={1.8} className="text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-medium text-neutral-900/80">{label}</p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Coming Soon
          </span>
        </div>
        <p className="mt-0.5 text-xs text-stone-400/80">{sublabel}</p>
      </div>
      <Toggle checked={false} onChange={() => {}} disabled />
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
function SkeletonRow({ last }: { last?: boolean }) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-3.5 ${last ? "" : "border-b border-stone-100"}`}>
      <div className="h-8 w-8 animate-pulse rounded-lg bg-stone-100" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-36 animate-pulse rounded bg-stone-100" />
        <div className="h-2.5 w-48 animate-pulse rounded bg-stone-100" />
      </div>
      <div className="h-7 w-12 animate-pulse rounded-full bg-stone-100" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Saved-as toast feedback
// ─────────────────────────────────────────────
function SavedToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-teal-100 bg-white px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <CheckCircle2 size={14} className="text-teal-500" />
      <p className="text-[13px] font-semibold text-neutral-800">Privacy setting saved</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function AccountPrivacyPage() {
  const [privacy,  setPrivacy]   = useState<PrivacyState | null>(null);
  const [loading,  setLoading]   = useState(true);
  const [saving,   setSaving]    = useState(false);
  const [saveErr,  setSaveErr]   = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────
  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then((d: unknown) => {
        const data = d as { profile_public: boolean };
        setPrivacy({ profile_public: data.profile_public ?? true });
      })
      .catch(() => setPrivacy({ profile_public: true }))
      .finally(() => setLoading(false));
  }, []);

  // ── Save a single field ─────────────────────
  const save = useCallback(async (patch: Partial<PrivacyState>) => {
    if (!privacy) return;
    const optimistic = { ...privacy, ...patch };
    setPrivacy(optimistic);           // optimistic update
    setSaving(true);
    setSaveErr("");
    try {
      await apiFetch("/api/v1/auth/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      // Show saved toast
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setShowSaved(true);
      savedTimer.current = setTimeout(() => setShowSaved(false), 2200);
    } catch (err: unknown) {
      setPrivacy(privacy);            // revert on failure
      setSaveErr(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [privacy]);

  // ── Cleanup ─────────────────────────────────
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  return (
    <>
      <SavedToast show={showSaved} />

      <SettingsScreenHeader
        title="Account Privacy"
        backHref="/settings/privacy-safety"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("privacy-safety", "Account Privacy")}
      />

      <p className="px-4 pb-1 pt-2 text-xs text-stone-500">
        Control who can see your profile, trips, and activity on Rovvy.
      </p>

      {/* ── Section 1: Profile visibility ──────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Profile</SettingsSectionTitle>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow last />
          </>
        ) : (
          <>
            {/* Public profile — LIVE */}
            <LiveToggleRow
              icon={privacy?.profile_public ? Eye : EyeOff}
              label="Public profile"
              sublabel={
                privacy?.profile_public
                  ? "Anyone on Rovvy can view your profile, name, and avatar."
                  : "Your profile is private. Only you can see your full profile."
              }
              checked={privacy?.profile_public ?? true}
              onChange={(v) => save({ profile_public: v })}
              loading={saving}
              error={saveErr || undefined}
            />

            {/* Who can find you — Coming Soon */}
            <VisRow
              icon={Search}
              label="Search visibility"
              sublabel="Control who can find you by name or username"
              last
            />
          </>
        )}
      </div>

      {/* ── Section 2: Trips ───────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Trips</SettingsSectionTitle>
        <VisRow
          icon={Luggage}
          label="Trip visibility"
          sublabel="Who can see your upcoming and past trips"
        />
        <VisRow
          icon={UserCheck}
          label="Trip invite permissions"
          sublabel="Who can send you trip invitations"
        />
        <DisabledToggleRow
          icon={Eye}
          label="Show trips on profile"
          sublabel="Display your recent trips on your public profile page"
          last
        />
      </div>

      {/* ── Section 3: Content ────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Content visibility</SettingsSectionTitle>
        <VisRow
          icon={MapPin}
          label="Saved places"
          sublabel="Who can see your pinned and saved locations"
        />
        <VisRow
          icon={Map}
          label="Travel map"
          sublabel="Who can view your visited countries and travel map"
        />
        <DisabledToggleRow
          icon={Award}
          label="Travel badges"
          sublabel="Show your earned traveler badges on your public profile"
          last
        />
      </div>

      {/* ── Section 4: Activity ───────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Activity</SettingsSectionTitle>
        <DisabledToggleRow
          icon={Zap}
          label="Activity status"
          sublabel="Show others when you are active on Rovvy"
        />
        <DisabledToggleRow
          icon={Globe}
          label="Suggested to others"
          sublabel="Allow Rovvy to suggest your profile to other travelers"
        />
        <DisabledToggleRow
          icon={Shield}
          label="Data for personalization"
          sublabel="Use your activity to personalise Rovvy suggestions and feed"
          last
        />
      </div>

      {/* ── Quick links ───────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Related settings</SettingsSectionTitle>
        <a
          href="/settings/blocked"
          className="group flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 transition-all duration-150 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
            <Users size={16} strokeWidth={1.8} className="text-blue-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-neutral-900">Blocked users</p>
            <p className="mt-0.5 text-xs text-stone-400">
              Manage accounts you have blocked
            </p>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-stone-300 transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </a>
        <a
          href="/privacy-policy"
          className="group flex items-center gap-3.5 px-4 py-3.5 transition-all duration-150 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
            <Shield size={16} strokeWidth={1.8} className="text-blue-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-neutral-900">Privacy Policy</p>
            <p className="mt-0.5 text-xs text-stone-400">
              Read how Rovvy collects and uses your data
            </p>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-stone-300 transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </a>
      </div>

      <SettingsPageFooter />
    </>
  );
}
