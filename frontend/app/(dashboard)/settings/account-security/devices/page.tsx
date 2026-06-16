"use client";

import { Globe, Laptop, LayoutGrid, Smartphone } from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import {
  SettingsBreadcrumb,
  nestedCrumbs,
} from "@/components/settings/SettingsBreadcrumb";

export default function DevicesPage() {
  return (
    <>
      <SettingsScreenHeader
        title="Devices"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb crumbs={nestedCrumbs("account-security", "Devices")} />

      {/* Current device */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>This device</SettingsSectionTitle>

        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <Globe size={16} strokeWidth={1.8} className="text-teal-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] text-neutral-900">Web Browser</p>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
                Current
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-400">
              Last active · Right now
            </p>
          </div>
        </div>
      </div>

      {/* Other devices – empty state */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Other trusted devices</SettingsSectionTitle>

        <div className="flex flex-col items-center py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
            <Smartphone size={24} className="text-stone-400" />
          </div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">
            No other devices
          </p>
          <p className="mt-1.5 max-w-[260px] text-sm text-stone-500">
            Devices where you are signed in to Rovvy will appear here. You can
            remove them at any time.
          </p>
        </div>
      </div>

      {/* About trusted devices */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>About devices</SettingsSectionTitle>

        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Laptop size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Trusted device list
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                When you sign in from a new device, it will be added here so you
                can review and revoke access if needed.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <LayoutGrid size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">
                Per-device session management
              </p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                Full session control — including individual sign-out — is coming
                in an upcoming Rovvy update.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="mx-3 mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
        <p className="text-xs text-teal-700">
          Device management is coming soon. You will be notified when you can
          review and remove individual trusted devices.
        </p>
      </div>

      <SettingsPageFooter />
    </>
  );
}
