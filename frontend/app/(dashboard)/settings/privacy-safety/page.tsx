"use client";

import {
  AlertTriangle, Ban, Eye, Flag, Lock,
  MessageCircle, Phone, ShieldAlert, UserX,
} from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function PrivacySafetyPage() {
  return (
    <>
      <SettingsScreenHeader title="Privacy & Safety" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("privacy-safety")} />

      <div className="bg-white">
        <SettingsSectionTitle>Account privacy</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/privacy"
          icon={Lock}
          label="Account Privacy"
          sublabel="Control who can see your profile and trips"
        />
        <SettingsHubRow
          href="/settings/interactions#messages"
          icon={MessageCircle}
          label="Message Permissions"
          sublabel="Who can send you messages"
        />
        <SettingsHubRow
          icon={Eye}
          label="Trip Invite Permissions"
          sublabel="Who can invite you to trips"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Managing people</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/blocked"
          icon={Ban}
          label="Blocked Users"
          sublabel="Accounts you have blocked"
        />
        <SettingsHubRow
          href="/settings/interactions#restricted"
          icon={UserX}
          label="Restricted Users"
          sublabel="Limit interactions without blocking"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Safety</SettingsSectionTitle>
        <SettingsHubRow
          icon={Phone}
          label="Emergency Contacts"
          sublabel="People to contact in emergencies"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={ShieldAlert}
          label="Safety Center"
          sublabel="Resources and tools to stay safe"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={AlertTriangle}
          label="Report Settings"
          sublabel="Configure how reports are handled"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Flag}
          label="Hidden Words"
          sublabel="Filter sensitive content"
          href="/settings/interactions#hidden"
        />
      </div>
    </>
  );
}
