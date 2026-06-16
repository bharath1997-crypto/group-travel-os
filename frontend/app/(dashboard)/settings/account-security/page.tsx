"use client";

import {
  Activity, CheckCircle2, ChevronRight, Cpu,
  KeyRound, Link2, LogIn, Shield, Smartphone, UserCircle,
} from "lucide-react";
import { useCallback } from "react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

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

      <div className="bg-white">
        <SettingsSectionTitle>Your profile</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/edit-profile"
          icon={UserCircle}
          label="Personal Information"
          sublabel="Name, photo, bio, travel preferences"
        />
        <SettingsHubRow
          href="/settings/account"
          icon={CheckCircle2}
          label="Account Status"
          sublabel="Verification level, badges, standing"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Sign-in & security</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/security"
          icon={KeyRound}
          label="Password & Sign-In"
          sublabel="Update password, manage sessions"
        />
        <SettingsHubRow
          icon={Shield}
          label="Two-Factor Authentication"
          sublabel="Add an extra layer of protection"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={LogIn}
          label="Login Activity"
          sublabel="See where you're signed in"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Smartphone}
          label="Devices"
          sublabel="Manage trusted devices"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Connected accounts</SettingsSectionTitle>
        <SettingsHubRow
          icon={Link2}
          label="Connected Accounts"
          sublabel="Google, Apple, Facebook"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Cpu}
          label="Verification"
          sublabel="ID and identity verification"
          badge="Coming Soon"
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
    </>
  );
}
