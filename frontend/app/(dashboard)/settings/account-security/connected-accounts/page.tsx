"use client";

import { Calendar, HardDrive, Link2, Link2Off, ShieldCheck } from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import {
  SettingsBreadcrumb,
  nestedCrumbs,
} from "@/components/settings/SettingsBreadcrumb";

// ── Brand SVG icons ────────────────────────────────────────────────────────────
function GoogleIcon({ muted = false }: { muted?: boolean }) {
  if (muted) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#8BB4E8" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#7DC18A" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#E5C96E" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#E07B75" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={muted ? "#9ca3af" : "white"}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
    </svg>
  );
}

// ── Coming Soon badge ─────────────────────────────────────────────────────────
function ComingSoonBadge() {
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
      Coming Soon
    </span>
  );
}

// ── Provider row (sign-in account) ────────────────────────────────────────────
function ProviderRow({
  iconContainerClass,
  iconContent,
  label,
  sublabel,
}: {
  iconContainerClass: string;
  iconContent: React.ReactNode;
  label: string;
  sublabel: string;
}) {
  return (
    <div
      role="button"
      aria-label={`${label} — Coming Soon`}
      aria-disabled="true"
      tabIndex={-1}
      className="flex cursor-default select-none items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 opacity-80 last:border-b-0"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconContainerClass}`}
      >
        {iconContent}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-neutral-900/80">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400/80">{sublabel}</p>
      </div>
      <ComingSoonBadge />
    </div>
  );
}

// ── Service row (connected integration) ──────────────────────────────────────
function ServiceRow({
  href,
  icon: Icon,
  label,
  sublabel,
  comingSoon,
}: {
  href?: string;
  icon: React.ElementType;
  label: string;
  sublabel: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
        <Icon
          size={16}
          strokeWidth={1.8}
          className={comingSoon ? "text-teal-400" : "text-teal-700"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-neutral-900/80">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400/80">{sublabel}</p>
      </div>
      {comingSoon ? (
        <ComingSoonBadge />
      ) : (
        <svg
          className="h-4 w-4 shrink-0 text-stone-300 transition-transform duration-150 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
      )}
    </>
  );

  if (comingSoon || !href) {
    return (
      <div
        role="button"
        aria-label={`${label} — Coming Soon`}
        aria-disabled="true"
        tabIndex={-1}
        className="flex cursor-default select-none items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 opacity-80 last:border-b-0"
      >
        {inner}
      </div>
    );
  }

  return (
    <a
      href={href}
      aria-label={label}
      className="group flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 transition-all duration-150 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 last:border-b-0"
    >
      {inner}
    </a>
  );
}

// ── Security info row (non-clickable) ─────────────────────────────────────────
function SecurityRow({
  icon: Icon,
  label,
  body,
  last,
}: {
  icon: React.ElementType;
  label: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div className={`px-4 py-3.5 ${last ? "" : "border-b border-stone-100"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
          <Icon size={16} strokeWidth={1.8} className="text-teal-700" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-neutral-900">{label}</p>
          <p className="mt-0.5 text-xs leading-snug text-stone-400">{body}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ConnectedAccountsPage() {
  return (
    <>
      <SettingsScreenHeader
        title="Connected Accounts"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Connected Accounts")}
      />

      {/* Intro notice */}
      <div className="mx-3 mt-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-xs leading-relaxed text-stone-500">
          Link third-party accounts to sign in faster and manage connected
          services. You can disconnect at any time.
        </p>
      </div>

      {/* Sign-in accounts */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Sign-in accounts</SettingsSectionTitle>
        <ProviderRow
          iconContainerClass="border-stone-200 bg-white"
          iconContent={<GoogleIcon />}
          label="Google"
          sublabel="Sign in with your Google account"
        />
        <ProviderRow
          iconContainerClass="border-stone-900 bg-black"
          iconContent={<AppleIcon />}
          label="Apple"
          sublabel="Sign in with your Apple ID"
        />
        <ProviderRow
          iconContainerClass="border-blue-700 bg-blue-600"
          iconContent={
            <span
              className="text-[15px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              f
            </span>
          }
          label="Facebook"
          sublabel="Sign in with your Facebook account"
        />
      </div>

      {/* Connected services */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Connected services</SettingsSectionTitle>
        <ServiceRow
          href="/settings/data-integrations/google-calendar"
          icon={Calendar}
          label="Google Calendar"
          sublabel="Sync Rovvy trips with your Google Calendar"
          comingSoon={false}
        />
        <ServiceRow
          href="/settings/data-integrations/google-drive"
          icon={HardDrive}
          label="Google Drive"
          sublabel="Back up your Rovvy exports to Google Drive"
          comingSoon={false}
        />
      </div>

      {/* Privacy & security */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Privacy &amp; security</SettingsSectionTitle>
        <SecurityRow
          icon={Link2}
          label="Encrypted token storage"
          body="Rovvy does not store your third-party passwords. OAuth tokens are encrypted at rest with AES-256."
        />
        <SecurityRow
          icon={Link2Off}
          label="Revoke access anytime"
          body="Disconnect linked accounts here or from the provider's settings. Your Rovvy data is unaffected."
        />
        <SecurityRow
          icon={ShieldCheck}
          label="Minimal permissions"
          body="Rovvy only requests the permissions needed for each connected service — nothing more."
          last
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
