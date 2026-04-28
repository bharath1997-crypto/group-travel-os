"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import { SettingsScreenHeader, SettingsSectionTitle, SettingsToggleRow } from "../_components";

export default function SettingsUsagePage() {
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
        <SettingsScreenHeader title="How you use Group Travel" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const u = prefSection<Record<string, unknown>>(prefs, "usage");

  return (
    <>
      <SettingsScreenHeader title="How you use Group Travel" backHref="/settings" />
      <div id="archive" className="scroll-mt-16">
        <SettingsSectionTitle>Archive</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Past trips stay in your Trips tab. We will add full archive tools here
          as the product grows.
        </p>
      </div>
      <div id="activity" className="scroll-mt-16">
        <SettingsSectionTitle>Your activity</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Pins, votes, and trip joins already show across the app. A dedicated
          activity log is on the roadmap.
        </p>
      </div>
      <div id="time" className="scroll-mt-16">
        <SettingsToggleRow
          label="Time management reminders"
          sublabel="Gentle nudges before departures and renewals"
          checked={Boolean(u.time_management_reminders)}
          busy={busy}
          onToggle={(v) =>
            void merge({ usage: { time_management_reminders: v } })
          }
        />
      </div>
      <div id="tablet" className="scroll-mt-16">
        <SettingsToggleRow
          label="Group Travel for tablets"
          sublabel="Use a roomier layout when width allows"
          checked={Boolean(u.tablet_optimized)}
          busy={busy}
          onToggle={(v) => void merge({ usage: { tablet_optimized: v } })}
        />
      </div>
      <div id="tv" className="scroll-mt-16">
        <SettingsToggleRow
          label="Group Travel for TV"
          sublabel="Experimental large-screen trip dashboards"
          checked={Boolean(u.tv_optimized)}
          busy={busy}
          onToggle={(v) => void merge({ usage: { tv_optimized: v } })}
        />
      </div>
    </>
  );
}
