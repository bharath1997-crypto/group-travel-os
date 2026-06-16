"use client";

import { Apple, CalendarDays, Download, FileDown, Import, Map, Package, Upload } from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

export default function DataIntegrationsPage() {
  return (
    <>
      <SettingsScreenHeader title="Data & Integrations" backHref="/settings" />

      <div className="bg-white">
        <SettingsSectionTitle>Export your data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/export"
          icon={Download}
          label="Download My Data"
          sublabel="Request an archive of your account data"
        />
        <SettingsHubRow
          href="/settings/data-integrations/export-trips"
          icon={FileDown}
          label="Export Trips"
          sublabel="Download trips as JSON or Calendar (.ics)"
        />
        <SettingsHubRow
          icon={Package}
          label="Export Memories"
          sublabel="Photos, notes, and highlights"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Map}
          label="Export Maps"
          sublabel="Download saved maps as KML/GPX"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Import data</SettingsSectionTitle>
        <SettingsHubRow
          icon={Upload}
          label="Import Data"
          sublabel="Bring in trips from other services"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Connected services</SettingsSectionTitle>
        <SettingsHubRow
          icon={CalendarDays}
          label="Google Calendar Sync"
          sublabel="Sync your trips to Google Calendar"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Import}
          label="Google Integration"
          sublabel="Maps, Drive, and Gmail"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Apple}
          label="Apple Integration"
          sublabel="Apple Maps, Calendar, and iCloud"
          badge="Coming Soon"
        />
      </div>
    </>
  );
}
