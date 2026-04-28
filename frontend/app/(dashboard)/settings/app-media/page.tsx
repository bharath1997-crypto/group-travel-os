"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import { SettingsScreenHeader, SettingsSectionTitle, SettingsToggleRow } from "../_components";

export default function SettingsAppMediaPage() {
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
        <SettingsScreenHeader title="App & media" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const m = prefSection<Record<string, unknown>>(prefs, "app_media");
  const mq = String(m.media_quality ?? "auto");
  const lang = String(m.language ?? "en");

  return (
    <>
      <SettingsScreenHeader title="App & media" backHref="/settings" />
      <div id="permissions" className="scroll-mt-16">
        <SettingsSectionTitle>Device permissions</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Location, photos, and notifications are requested in context (map,
          uploads, alerts). Use your OS settings to revoke access anytime.
        </p>
      </div>
      <div id="archiving" className="scroll-mt-16">
        <SettingsToggleRow
          label="Archiving & downloads"
          sublabel="Allow itineraries to be exported as PDF from trips"
          checked={Boolean(m.archiving_auto)}
          busy={busy}
          onToggle={(v) => void merge({ app_media: { archiving_auto: v } })}
        />
      </div>
      <div id="accessibility" className="scroll-mt-16">
        <SettingsToggleRow
          label="Larger interface text"
          sublabel="Boost font sizes across dashboard surfaces"
          checked={Boolean(m.accessibility_large_text)}
          busy={busy}
          onToggle={(v) =>
            void merge({ app_media: { accessibility_large_text: v } })
          }
        />
      </div>
      <div id="language" className="scroll-mt-16">
        <SettingsSectionTitle>Language</SettingsSectionTitle>
        <div className="flex flex-wrap gap-2 border-b border-stone-100 px-4 py-3">
          {(
            [
              ["en", "English"],
              ["es", "Español"],
              ["fr", "Français"],
              ["hi", "हिन्दी"],
            ] as const
          ).map(([code, lab]) => (
            <button
              key={code}
              type="button"
              disabled={busy}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                lang === code
                  ? "bg-[#E94560] text-white"
                  : "bg-stone-100 text-stone-700"
              }`}
              onClick={() => void merge({ app_media: { language: code } })}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>
      <div id="data" className="scroll-mt-16">
        <SettingsSectionTitle>Data usage &amp; quality</SettingsSectionTitle>
        <SettingsToggleRow
          label="Reduce data usage"
          sublabel="Prefer lower-resolution map tiles off Wi‑Fi"
          checked={Boolean(m.reduce_data_usage)}
          busy={busy}
          onToggle={(v) =>
            void merge({ app_media: { reduce_data_usage: v } })
          }
        />
        <div className="border-b border-stone-100 px-4 py-3">
          <p className="text-[15px] text-neutral-900">Media quality</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["auto", "Auto"],
                ["high", "High"],
                ["data_saver", "Data saver"],
              ] as const
            ).map(([v, lab]) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  mq === v
                    ? "bg-[#E94560] text-white"
                    : "bg-stone-100 text-stone-700"
                }`}
                onClick={() => void merge({ app_media: { media_quality: v } })}
              >
                {lab}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
