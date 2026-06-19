"use client";

import {
  Clock, Download, Eye, Layers,
  Map, MapPin, Navigation, Radio, Share2,
} from "lucide-react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function MapsTripLivePage() {
  return (
    <>
      <SettingsScreenHeader title="Maps & Trip LIVE" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("maps-trip-live")} />

      <div className="bg-white">
        <SettingsSectionTitle>Your maps</SettingsSectionTitle>
        <SettingsHubRow
          href="/explore/map"
          icon={Map}
          label="Your Maps"
          sublabel="View and manage your saved maps"
          accentColor="green"
        />
        <SettingsHubRow
          href="/explore"
          icon={MapPin}
          label="Saved Places"
          sublabel="Bookmarked destinations and spots"
          accentColor="green"
        />
        <SettingsHubRow
          icon={Download}
          label="Offline Maps"
          sublabel="Download areas for offline use"
          badge="Coming Soon"
          accentColor="green"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Navigation</SettingsSectionTitle>
        <SettingsHubRow
          icon={Navigation}
          label="Navigation Settings"
          sublabel="Voice, units, map orientation"
          badge="Coming Soon"
          accentColor="green"
        />
        <SettingsHubRow
          icon={Layers}
          label="Map Appearance"
          sublabel="Satellite, terrain, transit layers"
          badge="Coming Soon"
          accentColor="green"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Trip LIVE</SettingsSectionTitle>
        <SettingsHubRow
          icon={Radio}
          label="Trip LIVE Settings"
          sublabel="Update frequency, battery mode"
          badge="Coming Soon"
          accentColor="green"
        />
        <SettingsHubRow
          icon={Share2}
          label="Location Sharing"
          sublabel="Who can see your location in trips"
          badge="Coming Soon"
          accentColor="green"
        />
        <SettingsHubRow
          icon={Clock}
          label="Location History"
          sublabel="View and clear your location history"
          badge="Coming Soon"
          accentColor="green"
        />
        <SettingsHubRow
          icon={Eye}
          label="Map Privacy Controls"
          sublabel="Control what others see on the map"
          badge="Coming Soon"
          accentColor="green"
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
