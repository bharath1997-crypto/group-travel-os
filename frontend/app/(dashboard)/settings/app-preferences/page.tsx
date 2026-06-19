"use client";

import { Accessibility, BarChart2, DollarSign, Globe, Map, Moon, Ruler, Smartphone } from "lucide-react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function AppPreferencesPage() {
  return (
    <>
      <SettingsScreenHeader title="App Preferences" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("app-preferences")} />

      <div className="bg-white">
        <SettingsSectionTitle>Language &amp; region</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/locale"
          icon={Globe}
          label="Language"
          sublabel="App display language"
          accentColor="slate"
        />
        <SettingsHubRow
          href="/settings/locale"
          icon={DollarSign}
          label="Currency"
          sublabel="Prices and expenses currency"
          accentColor="slate"
        />
        <SettingsHubRow
          href="/settings/locale"
          icon={Ruler}
          label="Units"
          sublabel="km or mi, Celsius or Fahrenheit"
          accentColor="slate"
        />
        <SettingsHubRow
          icon={Map}
          label="Regional Settings"
          sublabel="Local formats, time zones"
          badge="Coming Soon"
          accentColor="slate"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Display</SettingsSectionTitle>
        <SettingsHubRow
          icon={Moon}
          label="Theme"
          sublabel="Light, dark, or system default"
          badge="Coming Soon"
          accentColor="slate"
        />
        <SettingsHubRow
          href="/settings/app-media#accessibility"
          icon={Accessibility}
          label="Accessibility"
          sublabel="Font size, contrast, motion"
          accentColor="slate"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Device &amp; data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/app-media#permissions"
          icon={Smartphone}
          label="Device Permissions"
          sublabel="Camera, microphone, location"
          accentColor="slate"
        />
        <SettingsHubRow
          href="/settings/app-media#data"
          icon={BarChart2}
          label="Data Usage"
          sublabel="Cellular data, media quality"
          accentColor="slate"
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
