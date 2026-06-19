"use client";

import {
  Activity, CheckCircle2, Cpu,
  KeyRound, Link2, LogIn, Shield, Smartphone, UserCircle,
} from "lucide-react";
import { useCallback } from "react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function AccountSecurityPage() {
  const handleSignOut = useCallback(() => {
    if (!window.confirm("Sign out of all devices?")) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  return (
    <>
      <SettingsScreenHeader title="Account & Security" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("account-security")} />

      <div className="bg-white">
        <SettingsSectionTitle>Your profile</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/edit-profile"
          icon={UserCircle}
          label="Personal Information"
          sublabel="Name, photo, bio, travel preferences"
          accentColor="teal"
        />
        <SettingsHubRow
          href="/settings/account-security/account-status"
          icon={CheckCircle2}
          label="Account Status"
          sublabel="Verification level, badges, standing"
          accentColor="teal"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Sign-in &amp; security</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/account-security/password-signin"
          icon={KeyRound}
          label="Password & Sign-In"
          sublabel="Update password, manage sessions"
          accentColor="teal"
        />
        <SettingsHubRow
          href="/settings/account-security/two-factor"
          icon={Shield}
          label="Two-Factor Authentication"
          sublabel="Add an extra layer of protection"
          accentColor="teal"
        />
        <SettingsHubRow
          href="/settings/account-security/login-activity"
          icon={LogIn}
          label="Login Activity"
          sublabel="See where you're signed in"
          accentColor="teal"
        />
        <SettingsHubRow
          href="/settings/account-security/devices"
          icon={Smartphone}
          label="Devices"
          sublabel="Manage trusted devices"
          accentColor="teal"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Connected accounts</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/account-security/connected-accounts"
          icon={Link2}
          label="Connected Accounts"
          sublabel="Google, Apple, Facebook"
          accentColor="teal"
        />
        <SettingsHubRow
          href="/settings/account-security/verification"
          icon={Cpu}
          label="Verification"
          sublabel="ID and identity verification"
          accentColor="teal"
        />
      </div>

      <div className="mt-6 bg-white">
        <SettingsSectionTitle>Account actions</SettingsSectionTitle>
        <SettingsHubRow
          icon={Activity}
          label="Sign out of all devices"
          danger
          onClick={handleSignOut}
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
