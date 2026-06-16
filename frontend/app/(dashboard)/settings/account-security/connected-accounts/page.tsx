"use client";

import { Link2, Link2Off } from "lucide-react";

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
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
    </svg>
  );
}

// ── Provider row ──────────────────────────────────────────────────────────────
function ProviderRow({
  iconBg,
  iconContent,
  label,
  sublabel,
}: {
  iconBg: string;
  iconContent: React.ReactNode;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex cursor-default select-none items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 opacity-80 pointer-events-none last:border-b-0">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 ${iconBg}`}
      >
        {iconContent}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400">{sublabel}</p>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
        Coming Soon
      </span>
    </div>
  );
}

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

      {/* Intro */}
      <div className="mx-3 mt-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-xs text-stone-500">
          Link a third-party account to sign in to Rovvy without a separate
          password. You can disconnect at any time and your data is not shared.
        </p>
      </div>

      {/* Providers */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Available accounts</SettingsSectionTitle>
        <ProviderRow
          iconBg="bg-white"
          iconContent={<GoogleIcon />}
          label="Google"
          sublabel="Sign in with your Google account"
        />
        <ProviderRow
          iconBg="bg-black"
          iconContent={<AppleIcon />}
          label="Apple"
          sublabel="Sign in with Apple ID"
        />
        <ProviderRow
          iconBg="bg-blue-600"
          iconContent={
            <span className="text-[14px] font-bold leading-none text-white">
              f
            </span>
          }
          label="Facebook"
          sublabel="Sign in with your Facebook account"
        />
      </div>

      {/* Privacy */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Privacy & security</SettingsSectionTitle>

        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Link2 size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Encrypted token storage
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                Rovvy never stores your third-party passwords. OAuth tokens are
                encrypted at rest with AES-256.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Link2Off size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Revoke access anytime
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                Disconnect any linked account here or from the third-party
                provider's settings. Your Rovvy data is unaffected.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SettingsPageFooter />
    </>
  );
}
