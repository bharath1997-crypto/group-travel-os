"use client";

import { Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import {
  SettingsLinkRow,
  SettingsScreenHeader,
  SettingsSectionTitle,
  SettingsToggleRow,
} from "../_components";

export default function SettingsGeneralPage() {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const b = await fetchAppSettings();
    setPrefs(b.preferences);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (id) {
      window.requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }, [prefs]);

  async function merge(patch: AppPreferences) {
    setBusy(true);
    try {
      const b = await patchAppSettings(patch);
      setPrefs(b.preferences);
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) {
    return (
      <>
        <SettingsScreenHeader title="General" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const g = prefSection<Record<string, unknown>>(prefs, "general");
  const cross = Boolean(g.crossposting_enabled);
  const actFriends = Boolean(g.activity_in_friends_tab);
  const loc = String(g.story_live_location_sharing ?? "friends_only");

  return (
    <>
      <SettingsScreenHeader title="General" backHref="/settings" />
      <div id="close-friends" className="scroll-mt-16">
        <SettingsSectionTitle>Close friends</SettingsSectionTitle>
        <div className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Favorite people for trip updates and map highlights. Manage the list from
          your travel hub connections — counts sync in Settings home.
        </div>
        <SettingsLinkRow
          href="/travel-hub"
          icon={Users}
          label="Manage connections"
          sublabel="Add or remove travelers you trust most"
        />
      </div>
      <div id="crosspost" className="scroll-mt-16">
        <SettingsToggleRow
          label="Crossposting"
          sublabel="Share Group Travel highlights to linked apps when you choose"
          checked={cross}
          busy={busy}
          onToggle={(v) => void merge({ general: { crossposting_enabled: v } })}
        />
      </div>
      <div id="story-location" className="scroll-mt-16">
        <SettingsSectionTitle>Story, live &amp; location</SettingsSectionTitle>
        <p className="px-4 pb-2 text-xs text-stone-500">
          Who can see live trip check-ins and location on the map
        </p>
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {(
            [
              ["off", "Off"],
              ["friends_only", "Friends only"],
              ["everyone", "Everyone"],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              disabled={busy}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                loc === k
                  ? "bg-[#E94560] text-white"
                  : "bg-stone-100 text-stone-700"
              }`}
              onClick={() =>
                void merge({ general: { story_live_location_sharing: k } })
              }
            >
              {lab}
            </button>
          ))}
        </div>
      </div>
      <div id="activity-friends" className="scroll-mt-16">
        <SettingsToggleRow
          label="Activity in Friends tab"
          sublabel="Show your trip pulse to accepted connections"
          checked={actFriends}
          busy={busy}
          onToggle={(v) => void merge({ general: { activity_in_friends_tab: v } })}
        />
      </div>
    </>
  );
}
