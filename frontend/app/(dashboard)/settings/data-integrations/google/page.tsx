"use client";

import { CalendarDays, HardDrive, Mail, Image } from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../../_components";

export default function GoogleIntegrationPage() {
  return (
    <>
      <SettingsScreenHeader title="Google Integration" backHref="/settings/data-integrations" />

      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Available</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/google-calendar"
          icon={CalendarDays}
          label="Google Calendar Sync"
          sublabel="Sync your Rovvy trips to Google Calendar"
        />
        <SettingsHubRow
          href="/settings/data-integrations/google-drive"
          icon={HardDrive}
          label="Google Drive Backup"
          sublabel="Back up your Rovvy exports to Google Drive"
        />
      </div>

      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Coming soon</SettingsSectionTitle>
        <SettingsHubRow
          icon={Mail}
          label="Gmail"
          sublabel="Trip confirmations and travel emails"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Image}
          label="Google Photos"
          sublabel="Trip memories and travel photos"
          badge="Coming Soon"
        />
      </div>
    </>
  );
}
