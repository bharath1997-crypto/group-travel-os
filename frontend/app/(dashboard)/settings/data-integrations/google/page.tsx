"use client";

import { CalendarDays, HardDrive, Mail, Image } from "lucide-react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../../_components";
import { SettingsBreadcrumb, dataCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function GoogleIntegrationPage() {
  return (
    <>
      <SettingsScreenHeader title="Google Integration" backHref="/settings/data-integrations" />
      <SettingsBreadcrumb crumbs={dataCrumbs("Google Integration")} />

      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Available</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/google-calendar"
          icon={CalendarDays}
          label="Google Calendar Sync"
          sublabel="Sync your Rovvy trips to Google Calendar"
          accentColor="blue"
        />
        <SettingsHubRow
          href="/settings/data-integrations/google-drive"
          icon={HardDrive}
          label="Google Drive Backup"
          sublabel="Back up your Rovvy exports to Google Drive"
          accentColor="blue"
        />
      </div>

      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Coming soon</SettingsSectionTitle>
        <SettingsHubRow
          icon={Mail}
          label="Gmail"
          sublabel="Trip confirmations and travel emails"
          badge="Coming Soon"
          accentColor="blue"
        />
        <SettingsHubRow
          icon={Image}
          label="Google Photos"
          sublabel="Trip memories and travel photos"
          badge="Coming Soon"
          accentColor="blue"
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
