"use client";

import { Accessibility, BarChart2, DollarSign, Globe, Map, Moon, Ruler, Smartphone } from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

export default function AppPreferencesPage() {
  return (
    <>
      <SettingsScreenHeader title="App Preferences" backHref="/settings" />

      <div className="bg-white">
        <SettingsSectionTitle>Language & region</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/locale"
          icon={Globe}
          label="Language"
          sublabel="App display language"
        />
        <SettingsHubRow
          href="/settings/locale"
          icon={DollarSign}
          label="Currency"
          sublabel="Prices and expenses currency"
        />
        <SettingsHubRow
          href="/settings/locale"
          icon={Ruler}
          label="Units"
          sublabel="km or mi, Celsius or Fahrenheit"
        />
        <SettingsHubRow
          icon={Map}
          label="Regional Settings"
          sublabel="Local formats, time zones"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Display</SettingsSectionTitle>
        <SettingsHubRow
          icon={Moon}
          label="Theme"
          sublabel="Light, dark, or system default"
          badge="Coming Soon"
        />
        <SettingsHubRow
          href="/settings/app-media#accessibility"
          icon={Accessibility}
          label="Accessibility"
          sublabel="Font size, contrast, motion"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Device & data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/app-media#permissions"
          icon={Smartphone}
          label="Device Permissions"
          sublabel="Camera, microphone, location"
        />
        <SettingsHubRow
          href="/settings/app-media#data"
          icon={BarChart2}
          label="Data Usage"
          sublabel="Cellular data, media quality"
        />
      </div>
    </>
  );
}
