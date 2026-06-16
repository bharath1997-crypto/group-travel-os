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
          href="/settings/data-integrations/export-maps"
          icon={Map}
          label="Export Maps"
          sublabel="Download saved places as GeoJSON"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Import data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/import-data"
          icon={Upload}
          label="Import Data"
          sublabel="Import places and trips from GeoJSON, GPX, or CSV"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Connected services</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/google-calendar"
          icon={CalendarDays}
          label="Google Calendar Sync"
          sublabel="Sync your trips to Google Calendar"
        />
        <SettingsHubRow
          href="/settings/data-integrations/google"
          icon={Import}
          label="Google Integration"
          sublabel="Calendar, Drive, and more"
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
