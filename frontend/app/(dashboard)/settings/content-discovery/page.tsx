"use client";

import {
  Compass, Filter, Gem, Heart, Image,
  LayoutGrid, Sparkles, Star, User, Wand2,
} from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
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
        />
        <SettingsHubRow
          icon={Star}
          label="Event Preferences"
          sublabel="Music, sports, food, culture"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Sparkles}
          label="AI Recommendations"
          sublabel="Let Wayra suggest experiences for you"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Feed & discovery</SettingsSectionTitle>
        <SettingsHubRow
          icon={Compass}
          label="Discovery Settings"
          sublabel="What shows up on your explore feed"
          badge="Coming Soon"
        />
        <SettingsHubRow
          href="/settings/content"
          icon={Filter}
          label="Content Filters"
          sublabel="Filter what you see in your feed"
        />
        <SettingsHubRow
          icon={Gem}
          label="Hidden Gems"
          sublabel="Off-the-beaten-path recommendations"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={LayoutGrid}
          label="Personalized Feed"
          sublabel="Control your home feed algorithm"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Avatar & Identity</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/edit-profile"
          icon={User}
          label="Edit Profile"
          sublabel="Name, photo, bio"
        />
        <SettingsHubRow
          icon={Image}
          label="Upload Avatar"
          sublabel="Set a custom profile photo"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Wand2}
          label="AI Avatar"
          sublabel="Generate an avatar with AI"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Star}
          label="Travel Badges"
          sublabel="Earned milestones and achievements"
          badge="Coming Soon"
        />
      </div>
    </>
  );
}
