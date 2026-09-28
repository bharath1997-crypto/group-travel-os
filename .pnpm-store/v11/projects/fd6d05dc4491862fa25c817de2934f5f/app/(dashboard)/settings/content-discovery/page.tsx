"use client";

import {
  Compass, Filter, Gem, Heart, Image,
  LayoutGrid, Sparkles, Star, User, Wand2,
} from "lucide-react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function ContentDiscoveryPage() {
  return (
    <>
      <SettingsScreenHeader title="Content & Discovery" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("content-discovery")} />

      <div className="bg-white">
        <SettingsSectionTitle>Your interests</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/content#preferences"
          icon={Heart}
          label="Travel Interests"
          sublabel="Activities, destinations, travel styles"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={Star}
          label="Event Preferences"
          sublabel="Music, sports, food, culture"
          badge="Coming Soon"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={Sparkles}
          label="AI Recommendations"
          sublabel="Let Wayra suggest experiences for you"
          badge="Coming Soon"
          accentColor="orange"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Feed &amp; discovery</SettingsSectionTitle>
        <SettingsHubRow
          icon={Compass}
          label="Discovery Settings"
          sublabel="What shows up on your explore feed"
          badge="Coming Soon"
          accentColor="orange"
        />
        <SettingsHubRow
          href="/settings/content"
          icon={Filter}
          label="Content Filters"
          sublabel="Filter what you see in your feed"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={Gem}
          label="Hidden Gems"
          sublabel="Off-the-beaten-path recommendations"
          badge="Coming Soon"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={LayoutGrid}
          label="Personalized Feed"
          sublabel="Control your home feed algorithm"
          badge="Coming Soon"
          accentColor="orange"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Avatar &amp; identity</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/edit-profile"
          icon={User}
          label="Edit Profile"
          sublabel="Name, photo, bio"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={Image}
          label="Upload Avatar"
          sublabel="Set a custom profile photo"
          badge="Coming Soon"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={Wand2}
          label="AI Avatar"
          sublabel="Generate an avatar with AI"
          badge="Coming Soon"
          accentColor="orange"
        />
        <SettingsHubRow
          icon={Star}
          label="Travel Badges"
          sublabel="Earned milestones and achievements"
          badge="Coming Soon"
          accentColor="orange"
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
