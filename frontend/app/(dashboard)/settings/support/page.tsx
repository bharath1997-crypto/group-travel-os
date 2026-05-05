"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import { SettingsScreenHeader, SettingsSectionTitle, SettingsToggleRow } from "../_components";

export default function SettingsSupportPage() {
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
        <SettingsScreenHeader title="Support" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const p = prefSection<Record<string, unknown>>(prefs, "privacy_extra");
  const sup = prefSection<Record<string, unknown>>(prefs, "support");

  return (
    <>
      <SettingsScreenHeader title="Support & legal" backHref="/settings" />
      <div id="streak" className="scroll-mt-16">
        <SettingsSectionTitle>Travel streak help</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Lost a check-in streak? Email support@grouptravel.test with your
          username — we will verify group activity logs.
        </p>
        <SettingsToggleRow
          label="I have read streak guidance"
          checked={Boolean(sup.travel_streak_help_viewed)}
          busy={busy}
          onToggle={(v) =>
            void merge({ support: { travel_streak_help_viewed: v } })
          }
        />
      </div>
      <div id="bugs" className="scroll-mt-16">
        <SettingsSectionTitle>Bugs &amp; suggestions</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Send screenshots to bugs@grouptravel.test — include browser, trip
          link, and approximate time.
        </p>
      </div>
      <div id="safety" className="scroll-mt-16">
        <SettingsSectionTitle>Safety &amp; privacy overview</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Group Travel is built for coordinated trips — share itinerary links
          only with people you trust. Use blocked accounts for abusive behavior.
        </p>
      </div>
      <div id="help" className="scroll-mt-16">
        <SettingsSectionTitle>Help center</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Guides for expenses, polls, and map pins live in the dashboard sidebar
          under each feature. Ask the AI sidecar for quick tips.
        </p>
      </div>
      <div id="privacy" className="scroll-mt-16">
        <SettingsSectionTitle>Privacy policy</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          High level: we store trip coordination data you create, power real-time
          features with your consent, and delete on account closure. Full legal
          text will live at /legal/privacy when your counsel publishes it.
        </p>
      </div>
      <div id="terms" className="scroll-mt-16">
        <SettingsSectionTitle>Terms of service</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Beta travelers agree not to scrape the API, spam invitations, or
          upload illegal content. Formal terms URL TBD.
        </p>
      </div>
      <div id="regional-privacy" className="scroll-mt-16">
        <SettingsSectionTitle>Regional privacy choices</SettingsSectionTitle>
        <SettingsToggleRow
          label="California privacy choices"
          sublabel="Limit sale/share of personal data (CPRA-style)"
          checked={Boolean(p.california_privacy)}
          busy={busy}
          onToggle={(v) =>
            void merge({ privacy_extra: { california_privacy: v } })
          }
        />
        <SettingsToggleRow
          label="Florida privacy choices"
          sublabel="Opt into Florida-specific disclosures"
          checked={Boolean(p.florida_privacy)}
          busy={busy}
          onToggle={(v) =>
            void merge({ privacy_extra: { florida_privacy: v } })
          }
        />
      </div>
      <div id="my-data" className="scroll-mt-16">
        <SettingsSectionTitle>Generative AI</SettingsSectionTitle>
        <SettingsToggleRow
          label="AI-assisted suggestions"
          sublabel="Allow the assistant to personalize tips from your trips"
          checked={Boolean(p.generative_ai_features)}
          busy={busy}
          onToggle={(v) =>
            void merge({ privacy_extra: { generative_ai_features: v } })
          }
        />
        <SettingsSectionTitle>My data</SettingsSectionTitle>
        <SettingsToggleRow
          label="Request data export"
          sublabel="We will email an archive within 30 days (pilot)"
          checked={Boolean(p.my_data_export_requested)}
          busy={busy}
          onToggle={(v) =>
            void merge({ privacy_extra: { my_data_export_requested: v } })
          }
        />
      </div>
    </>
  );
}
