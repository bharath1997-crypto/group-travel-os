"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import { SettingsScreenHeader, SettingsSectionTitle, SettingsToggleRow } from "../_components";

export default function SettingsContentPage() {
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
        <SettingsScreenHeader title="What you see" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const c = prefSection<Record<string, unknown>>(prefs, "content");

  return (
    <>
      <SettingsScreenHeader title="What you see" backHref="/settings" />
      <div id="favorites" className="scroll-mt-16">
        <SettingsSectionTitle>Favorites</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Favorite creators and trips are coming soon — counts sync from your
          saved lists.
        </p>
      </div>
      <div id="muted" className="scroll-mt-16">
        <SettingsSectionTitle>Muted accounts</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Mute noisy travelers from connection cards without blocking them.
          Full management UI ships next; preferences store is ready.
        </p>
      </div>
      <div id="preferences" className="scroll-mt-16">
        <SettingsSectionTitle>Content preferences</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Tune destinations and activity types you want emphasized in Explore.
        </p>
      </div>
      <div id="counts" className="scroll-mt-16">
        <SettingsToggleRow
          label="Hide like & share counts"
          sublabel="Reduce vanity metrics on public trip cards"
          checked={Boolean(c.hide_like_share_counts)}
          busy={busy}
          onToggle={(v) =>
            void merge({ content: { hide_like_share_counts: v } })
          }
        />
      </div>
      <div id="creators" className="scroll-mt-16">
        <SettingsToggleRow
          label="Creator subscriptions"
          sublabel="Surface paid guides you follow in your feed"
          checked={Boolean(c.creator_subscriptions)}
          busy={busy}
          onToggle={(v) =>
            void merge({ content: { creator_subscriptions: v } })
          }
        />
      </div>
    </>
  );
}
