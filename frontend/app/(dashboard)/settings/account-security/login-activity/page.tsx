"use client";

import { Clock, Globe, Monitor, RefreshCw } from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import {
  SettingsBreadcrumb,
  nestedCrumbs,
} from "@/components/settings/SettingsBreadcrumb";

// ── Static session row ────────────────────────────────────────────────────────
function SessionRow({
  icon: Icon,
  label,
  detail,
  isActive,
}: {
  icon: React.ElementType;
  label: string;
  detail: string;
  isActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 last:border-b-0">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          isActive
            ? "border-teal-100 bg-teal-50"
            : "border-stone-100 bg-stone-50"
        }`}
      >
        <Icon
          size={16}
          strokeWidth={1.8}
          className={isActive ? "text-teal-700" : "text-stone-400"}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] text-neutral-900">{label}</p>
          {isActive && (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
              Active now
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-stone-400">{detail}</p>
      </div>
    </div>
  );
}

export default function LoginActivityPage() {
  return (
    <>
      <SettingsScreenHeader
        title="Login Activity"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Login Activity")}
      />

      {/* Current session */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Current session</SettingsSectionTitle>
        <SessionRow
          icon={Globe}
          label="Web Browser"
          detail="Active right now · Rovvy.app"
          isActive
        />
      </div>

      {/* History */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Recent logins</SettingsSectionTitle>

        <div className="flex flex-col items-center py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <Clock size={24} className="text-stone-400" />
          </div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">
            Login history coming soon
          </p>
          <p className="mt-1.5 max-w-[260px] text-sm text-stone-500">
            A full log of recent sign-ins, devices, and IP addresses will
            appear here in a future update.
          </p>
        </div>
      </div>

      {/* Devices quick link */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Manage sessions</SettingsSectionTitle>

        <a
          href="/settings/account-security/devices"
          className="group flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 transition-all duration-150 hover:bg-stone-50 last:border-b-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <Monitor size={16} strokeWidth={1.8} className="text-teal-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-neutral-900">Trusted devices</p>
            <p className="mt-0.5 text-xs text-stone-400">
              View and remove devices that have access to your account
            </p>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-stone-300 transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </a>

        <div className="flex cursor-default select-none items-center gap-3.5 px-4 py-3.5 opacity-80 pointer-events-none">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <RefreshCw size={16} strokeWidth={1.8} className="text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-neutral-900">Sign out all other devices</p>
            <p className="mt-0.5 text-xs text-stone-400">
              Revoke access from every device except this one
            </p>
          </div>
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-600">
            Coming Soon
          </span>
        </div>
      </div>

      <SettingsPageFooter />
    </>
  );
}
