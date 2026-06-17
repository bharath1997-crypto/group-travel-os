"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Award,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Globe,
  ImageIcon,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  User,
  UserCheck,
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
interface UserProfile {
  full_name: string;
  username: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  profile_picture: string | null;
  country: string | null;
  recovery_email: string | null;
  instagram_handle: string | null;
  google_sub: string | null;
  is_active: boolean;
  is_verified: boolean;
  email_verified: boolean;
  whatsapp_verified: boolean;
  profile_completion_filled: number;
  profile_completion_total: number;
  created_at: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function accountAge(createdAt: string) {
  const ms  = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function completionPercent(filled: number, total: number) {
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

// ─────────────────────────────────────────────
// Standing banner
// ─────────────────────────────────────────────
function StandingBanner({ active }: { active: boolean }) {
  if (active) {
    return (
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-white px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-white">
          <ShieldCheck size={20} className="text-teal-600" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-teal-800">Account in good standing</p>
          <p className="mt-0.5 text-xs text-teal-600">
            No restrictions · All features enabled
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-white">
        <AlertCircle size={20} className="text-red-500" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-red-700">Account restricted</p>
        <p className="mt-0.5 text-xs text-red-500">
          Some features may be limited. Contact support.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Status row (non-clickable info)
// ─────────────────────────────────────────────
function StatusRow({
  icon: Icon,
  label,
  detail,
  badge,
  last,
}: {
  icon: React.ElementType;
  label: string;
  detail?: string;
  badge: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3.5 ${last ? "" : "border-b border-stone-100"}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
        <Icon size={16} strokeWidth={1.8} className="text-teal-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-neutral-900">{label}</p>
        {detail && <p className="mt-0.5 text-xs text-stone-400">{detail}</p>}
      </div>
      {badge}
    </div>
  );
}

// ─────────────────────────────────────────────
// Verified badge
// ─────────────────────────────────────────────
function VerifiedBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-600">
      <CheckCircle2 size={10} />
      Verified
    </span>
  );
}

function UnverifiedBadge() {
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
      Unverified
    </span>
  );
}

function MissingBadge() {
  return (
    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-400">
      Not set
    </span>
  );
}

// ─────────────────────────────────────────────
// Profile completeness bar
// ─────────────────────────────────────────────
function CompletenessBar({ filled, total }: { filled: number; total: number }) {
  const pct = completionPercent(filled, total);
  const color =
    pct >= 80 ? "bg-teal-500"
    : pct >= 50 ? "bg-amber-400"
    : "bg-red-400";
  const label =
    pct >= 80 ? "Complete"
    : pct >= 50 ? "Partial"
    : "Incomplete";
  const textColor =
    pct >= 80 ? "text-teal-600"
    : pct >= 50 ? "text-amber-600"
    : "text-red-600";

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <User size={16} strokeWidth={1.8} className="text-teal-700" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-neutral-900">Profile completeness</p>
            <p className="mt-0.5 text-xs text-stone-400">
              {filled} of {total} fields filled
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${textColor} bg-transparent`}>
          {pct}%
        </span>
      </div>
      <div className="mt-3 pl-11">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Profile ${pct}% complete`}
          />
        </div>
        <p className={`mt-1 text-[11px] font-medium ${textColor}`}>{label}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Badge card
// ─────────────────────────────────────────────
function BadgeCard({
  icon: Icon,
  label,
  body,
  earned,
}: {
  icon: React.ElementType;
  label: string;
  body: string;
  earned: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-all ${
        earned
          ? "border-teal-100 bg-teal-50"
          : "border-stone-100 bg-stone-50 opacity-50"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
          earned ? "border-teal-100 bg-white" : "border-stone-200 bg-white"
        }`}
      >
        <Icon
          size={18}
          strokeWidth={1.8}
          className={earned ? "text-teal-600" : "text-stone-400"}
        />
      </div>
      <p className={`mt-2 text-[12px] font-semibold ${earned ? "text-teal-800" : "text-stone-500"}`}>
        {label}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{body}</p>
      {earned && (
        <span className="mt-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
          Earned
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-stone-100 ${className ?? ""}`} />
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function AccountStatusPage() {
  const [user, setUser]       = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then((data) => setUser(data as UserProfile))
      .catch(() => setError("Could not load account data."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SettingsScreenHeader
        title="Account Status"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Account Status")}
      />

      {/* Standing banner */}
      {loading ? (
        <div className="mx-3 mt-3 h-[62px] rounded-2xl bg-stone-100 animate-pulse" />
      ) : error ? (
        <div className="mx-3 mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      ) : user ? (
        <StandingBanner active={user.is_active} />
      ) : null}

      {/* ── Verification ──────────────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Verification</SettingsSectionTitle>

        {loading ? (
          <div className="space-y-px px-4 py-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <StatusRow
              icon={Mail}
              label="Email address"
              detail={user?.email}
              badge={user?.email_verified ? <VerifiedBadge /> : <UnverifiedBadge />}
            />
            <StatusRow
              icon={Shield}
              label="Account verified"
              detail="Rovvy identity verification"
              badge={user?.is_verified ? <VerifiedBadge /> : <UnverifiedBadge />}
            />
            <StatusRow
              icon={Phone}
              label="Phone number"
              detail={user?.phone ?? "No phone number added"}
              badge={
                !user?.phone
                  ? <MissingBadge />
                  : user.whatsapp_verified
                  ? <VerifiedBadge />
                  : <UnverifiedBadge />
              }
              last
            />
          </>
        )}
      </div>

      {/* ── Profile completeness ──────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Profile completeness</SettingsSectionTitle>

        {loading ? (
          <div className="px-4 py-3.5">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : user ? (
          <CompletenessBar
            filled={user.profile_completion_filled}
            total={user.profile_completion_total}
          />
        ) : null}

        {/* Completion checklist */}
        {!loading && user && (
          <div className="border-t border-stone-100 px-4 py-3">
            <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">
              Fields
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: User,      label: "Full name",  done: !!user.full_name },
                { icon: UserCheck, label: "Username",   done: !!user.username },
                { icon: Phone,     label: "Phone",      done: !!user.phone },
                { icon: ImageIcon, label: "Avatar",     done: !!(user.avatar_url ?? user.profile_picture) },
                { icon: MapPin,    label: "Country",    done: !!user.country },
                { icon: Mail,      label: "Recovery email", done: !!user.recovery_email },
              ].map(({ icon: Icon, label, done }) => (
                <div key={label} className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle2 size={13} className="shrink-0 text-teal-500" />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-stone-200" />
                  )}
                  <span className={`text-xs ${done ? "text-neutral-700" : "text-stone-400"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            {user.profile_completion_filled < user.profile_completion_total && (
              <a
                href="/settings/edit-profile"
                className="mt-3 block text-center text-xs font-semibold text-teal-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
              >
                Complete your profile →
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Account info ──────────────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Account information</SettingsSectionTitle>

        {loading ? (
          <div className="px-4 py-3.5">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : user ? (
          <>
            <StatusRow
              icon={Globe}
              label="Country / region"
              detail={user.country ?? "Not set"}
              badge={user.country ? <VerifiedBadge /> : <MissingBadge />}
            />
            <StatusRow
              icon={Clock}
              label="Member since"
              detail={new Date(user.created_at).toLocaleDateString("en-US", {
                month: "long",
                year:  "numeric",
              })}
              badge={
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-500">
                  {accountAge(user.created_at)}
                </span>
              }
              last
            />
          </>
        ) : null}
      </div>

      {/* ── Trusted Traveler Badges ───────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Traveler badges</SettingsSectionTitle>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 pt-2">
          <BadgeCard
            icon={BadgeCheck}
            label="Verified Traveler"
            body="Email confirmed"
            earned={!!user?.email_verified}
          />
          <BadgeCard
            icon={Star}
            label="Profile Star"
            body="Profile 80%+ complete"
            earned={completionPercent(
              user?.profile_completion_filled ?? 0,
              user?.profile_completion_total ?? 6
            ) >= 80}
          />
          <BadgeCard
            icon={Award}
            label="Early Member"
            body="Joined in the first year"
            earned={(() => {
              if (!user?.created_at) return false;
              const ms = Date.now() - new Date(user.created_at).getTime();
              return ms / 86_400_000 <= 365;
            })()}
          />
          <BadgeCard
            icon={Shield}
            label="Identity Verified"
            body="Full account verification"
            earned={!!user?.is_verified}
          />
        </div>
      </div>

      {/* ── Restrictions ─────────────────────────────────────── */}
      {user && !user.is_active && (
        <div className="mx-3 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p className="text-[13px] font-semibold text-red-700">Account restriction</p>
              <p className="mt-0.5 text-xs leading-snug text-red-500">
                Your account has been restricted. Some features may be
                unavailable. Please contact{" "}
                <a
                  href="/settings/support-legal/support"
                  className="font-semibold underline underline-offset-2"
                >
                  Rovvy support
                </a>{" "}
                for help.
              </p>
            </div>
          </div>
        </div>
      )}

      <SettingsPageFooter />
    </>
  );
}
