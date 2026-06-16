"use client";

import { Apple, CalendarDays, Download, FileDown, Import, Mail, Map, Package, Upload } from "lucide-react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function DataIntegrationsPage() {
  return (
    <>
      <SettingsScreenHeader title="Data & Integrations" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("data-integrations")} />

      <div className="bg-white">
        <SettingsSectionTitle>Export your data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/export"
          icon={Download}
          label="Download My Data"
          sublabel="Request an archive of your account data"
          accentColor="blue"
        />
        <SettingsHubRow
          href="/settings/data-integrations/export-trips"
          icon={FileDown}
          label="Export Trips"
          sublabel="Download trips as JSON or Calendar (.ics)"
          accentColor="blue"
        />
        <SettingsHubRow
          icon={Package}
          label="Export Memories"
          sublabel="Photos, notes, and highlights"
          badge="Coming Soon"
          accentColor="blue"
        />
        <SettingsHubRow
          href="/settings/data-integrations/export-maps"
          icon={Map}
          label="Export Maps"
          sublabel="Download saved places as GeoJSON"
          accentColor="blue"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Import data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/import-data"
          icon={Upload}
          label="Import Data"
          sublabel="Import places and trips from GeoJSON, GPX, or CSV"
          accentColor="blue"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Connected services</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations/google-calendar"
          icon={CalendarDays}
          label="Google Calendar Sync"
          sublabel="Sync your trips to Google Calendar"
          accentColor="blue"
        />
        <SettingsHubRow
          href="/settings/data-integrations/google"
          icon={Import}
          label="Google Integration"
          sublabel="Calendar, Drive, and more"
          accentColor="blue"
        />
        <SettingsHubRow
          href="/settings/data-integrations/apple"
          icon={Apple}
          label="Apple Integration"
          sublabel="Apple Maps and Calendar"
          accentColor="blue"
        />
        <SettingsHubRow
          href="/settings/data-integrations/outlook-calendar"
          icon={Mail}
          label="Outlook Calendar Sync"
          sublabel="Sync your trips to Microsoft Outlook Calendar"
          accentColor="blue"
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
