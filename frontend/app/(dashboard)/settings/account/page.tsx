"use client";

import {
  CreditCard,
  Lock,
  Shield,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchAppSettings,
  type AppSettingsBundle,
} from "@/lib/app-settings";
import {
  SettingsLinkRow,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../_components";

export default function SettingsAccountCenterPage() {
  const [bundle, setBundle] = useState<AppSettingsBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setBundle(await fetchAppSettings());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = bundle?.account.subscription_plan ?? "—";

  return (
    <>
      <SettingsScreenHeader title="Accounts center" backHref="/settings" />
      {err ? <p className="px-4 py-3 text-sm text-red-600">{err}</p> : null}
      {!bundle ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      ) : (
        <>
          <div className="px-4 py-3">
            <p className="text-sm text-stone-600">
              Manage passwords, verification, profile details, and how Group Travel
              uses your data across experiences.
            </p>
          </div>
          <SettingsSectionTitle>Membership</SettingsSectionTitle>
          <div className="bg-white">
            <SettingsLinkRow
              href="/subscription"
              icon={CreditCard}
              label="Subscription & billing"
              sublabel={`Current plan: ${plan}`}
            />
          </div>
          <SettingsSectionTitle>Profile & identity</SettingsSectionTitle>
          <div className="bg-white">
            <SettingsLinkRow
              href="/settings/edit-profile"
              icon={User}
              label="Personal details"
              sublabel="Name, username, photo, country, recovery email"
            />
          </div>
          <SettingsSectionTitle>Security</SettingsSectionTitle>
          <div className="bg-white">
            <SettingsLinkRow
              href="/settings/security"
              icon={Lock}
              label="Password & sign-in"
              sublabel="Password, two-factor, sessions"
            />
          </div>
          <SettingsSectionTitle>Trust</SettingsSectionTitle>
          <div className="bg-white">
            <SettingsLinkRow
              href="/settings/support#safety"
              icon={Shield}
              label="Safety tools"
              sublabel="Blocked users, reports, privacy overviews"
            />
          </div>
        </>
      )}
    </>
  );
}
