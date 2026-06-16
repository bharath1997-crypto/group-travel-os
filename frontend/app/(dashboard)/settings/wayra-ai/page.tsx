"use client";

import { Bot, Brain, Clock, Database, History, Sliders, Trash2 } from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

export default function WayraAIPage() {
  return (
    <>
      <SettingsScreenHeader title="Wayra AI" backHref="/settings" />

      {/* Beta notice */}
      <div className="mx-3 mt-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-orange-500" />
          <p className="text-sm font-semibold text-orange-800">Wayra is in Beta</p>
        </div>
        <p className="mt-1 text-xs text-orange-700">
          AI features are being actively developed. Settings marked "Coming Soon" will be available in upcoming releases.
        </p>
      </div>

      <div className="mt-2 bg-white">
        <SettingsSectionTitle>Assistant settings</SettingsSectionTitle>
        <SettingsHubRow
          icon={Sliders}
          label="AI Assistant Settings"
          sublabel="Response style, language, behaviour"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Brain}
          label="Personalization"
          sublabel="How Wayra adapts to your travel style"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Database}
          label="AI Memory"
          sublabel="What Wayra remembers about you"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>History & data</SettingsSectionTitle>
        <SettingsHubRow
          icon={History}
          label="AI History"
          sublabel="View past conversations with Wayra"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Clock}
          label="AI Data Controls"
          sublabel="Manage how your data trains the model"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Trash2}
          label="Clear AI History"
          sublabel="Delete all Wayra conversation history"
          badge="Coming Soon"
          danger
        />
      </div>
    </>
  );
}
