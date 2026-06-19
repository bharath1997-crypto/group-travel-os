"use client";

import {
  AlertCircle,
  CheckCircle2,
  Key,
  Lock,
  Mail,
  Shield,
  Smartphone,
} from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import { SettingsBreadcrumb, nestedCrumbs } from "@/components/settings/SettingsBreadcrumb";

// ── Static info row (no click) ───────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  label,
  body,
}: {
  icon: React.ElementType;
  label: string;
  body: string;
}) {
  return (
    <div className="border-b border-stone-100 px-4 py-3.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
          <Icon size={16} className="text-teal-700" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-neutral-900">{label}</p>
          <p className="mt-0.5 text-xs leading-snug text-stone-400">{body}</p>
        </div>
      </div>
    </div>
  );
}

// ── Method row (disabled, coming soon) ───────────────────────────────────────
function MethodRow({
  icon: Icon,
  label,
  sublabel,
  recommended,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  recommended?: boolean;
}) {
  return (
    <div className="flex cursor-default select-none items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 opacity-80 last:border-b-0 pointer-events-none">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
        <Icon size={16} className="text-teal-400" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] text-neutral-900">{label}</p>
          {recommended && (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
              Recommended
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-stone-400">{sublabel}</p>
      </div>
      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-600">
        Coming Soon
      </span>
    </div>
  );
}

export default function TwoFactorPage() {
  return (
    <>
      <SettingsScreenHeader
        title="Two-Factor Authentication"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Two-Factor Authentication")}
      />

      {/* Status banner */}
      <div className="mx-3 mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-amber-500" />
          <p className="text-[13px] font-semibold text-amber-800">
            2FA is not enabled on your account
          </p>
        </div>
        <p className="mt-1 text-xs text-amber-700">
          Enabling two-factor authentication adds a critical extra layer of
          security. We strongly recommend it.
        </p>
      </div>

      {/* Authentication methods */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Authentication methods</SettingsSectionTitle>
        <MethodRow
          icon={Smartphone}
          label="Authenticator App"
          sublabel="Google Authenticator, Authy, or any TOTP app"
          recommended
        />
        <MethodRow
          icon={Mail}
          label="Email Authentication"
          sublabel="Receive a one-time code to your registered email"
        />
        <MethodRow
          icon={Key}
          label="SMS / Text Message"
          sublabel="Receive codes via text to your phone number"
        />
      </div>

      {/* Why enable 2FA */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Why enable 2FA?</SettingsSectionTitle>
        <InfoRow
          icon={Lock}
          label="Blocks unauthorized access"
          body="Even if your password is stolen, attackers cannot sign in without the second factor."
        />
        <InfoRow
          icon={Shield}
          label="Protects your travel data"
          body="Keep your trips, expenses, saved places, and bookings secure."
        />
        <InfoRow
          icon={CheckCircle2}
          label="Industry-standard security"
          body="Used by the world's leading apps and recommended by security experts worldwide."
        />
      </div>

      {/* Coming soon notice */}
      <div className="mx-3 mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
        <p className="text-xs text-teal-700">
          Two-factor authentication is coming to Rovvy soon. You will receive an
          in-app notification when it is ready to enable.
        </p>
      </div>

      <SettingsPageFooter />
    </>
  );
}
