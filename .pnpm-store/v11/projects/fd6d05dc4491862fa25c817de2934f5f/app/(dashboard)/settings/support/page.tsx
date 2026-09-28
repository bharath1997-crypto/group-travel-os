"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";

import { SettingsScreenHeader, SettingsSectionTitle, SettingsToggleRow } from "../_components";
import { SettingsBreadcrumb, nestedCrumbs } from "@/components/settings/SettingsBreadcrumb";

const EMPTY_PREFS: AppPreferences = {};

export default function SettingsSupportPage() {
  const [prefs, setPrefs] = useState<AppPreferences>(EMPTY_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await fetchAppSettings();
      setPrefs(b.preferences);
    } catch {
      // Backend unavailable — render static content with default prefs
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loaded) return;
    const id = window.location.hash.replace("#", "");
    if (id) {
      window.requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }, [loaded]);

  async function merge(patch: AppPreferences) {
    setBusy(true);
    try {
      const b = await patchAppSettings(patch);
      setPrefs(b.preferences);
    } catch {
      // Ignore save errors when backend is unavailable
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <>
        <SettingsScreenHeader title="Support & legal" backHref="/settings" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-400" />
        </div>
      </>
    );
  }

  const p = prefSection<Record<string, unknown>>(prefs, "privacy_extra");
  const sup = prefSection<Record<string, unknown>>(prefs, "support");

  return (
    <>
      <SettingsScreenHeader title="Support & legal" backHref="/settings" />
      <SettingsBreadcrumb crumbs={nestedCrumbs("support-legal", "Support & Legal")} />

      <div id="streak" className="scroll-mt-16">
        <SettingsSectionTitle>Travel streak help</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Lost a check-in streak? Email{" "}
          <a href="mailto:support@rovvy.app" className="text-primary underline underline-offset-2">
            support@rovvy.app
          </a>{" "}
          with your username — we will verify group activity logs.
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
          Found a bug or have a feature idea? Email{" "}
          <a href="mailto:support@rovvy.app" className="text-primary underline underline-offset-2">
            support@rovvy.app
          </a>{" "}
          — include your browser, a description of what happened, and the approximate time.
        </p>
      </div>

      <div id="safety" className="scroll-mt-16">
        <SettingsSectionTitle>Safety &amp; privacy overview</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Rovvy is built for coordinated trips — share itinerary links only with
          people you trust. Use the blocked accounts feature for abusive behavior.
          Location sharing is always opt-in and can be disabled at any time.
        </p>
      </div>

      <div id="help" className="scroll-mt-16">
        <SettingsSectionTitle>Help center</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          Guides for expenses, polls, and map features live in the dashboard
          under each feature. Use Wayra (the AI assistant) for quick tips and
          travel recommendations.
        </p>
      </div>

      <div id="privacy" className="scroll-mt-16">
        <SettingsSectionTitle>Privacy policy</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          We store trip coordination data you create, power real-time features
          with your explicit consent, and delete your data on account closure.{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Read the full Privacy Policy →
          </Link>
        </p>
      </div>

      <div id="terms" className="scroll-mt-16">
        <SettingsSectionTitle>Terms of service</SettingsSectionTitle>
        <p className="border-b border-stone-100 px-4 py-3 text-sm text-stone-600">
          By using Rovvy you agree not to scrape the API, spam invitations, or
          upload illegal content.{" "}
          <Link href="/terms" className="text-primary underline underline-offset-2">
            Read the full Terms of Service →
          </Link>
        </p>
      </div>

      <div id="regional-privacy" className="scroll-mt-16">
        <SettingsSectionTitle>Regional privacy choices</SettingsSectionTitle>
        <SettingsToggleRow
          label="California privacy choices"
          sublabel="Limit sale/share of personal data (CPRA)"
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
          sublabel="Allow Wayra to personalise recommendations from your trips"
          checked={Boolean(p.generative_ai_features)}
          busy={busy}
          onToggle={(v) =>
            void merge({ privacy_extra: { generative_ai_features: v } })
          }
        />
        <SettingsSectionTitle>My data</SettingsSectionTitle>
        <SettingsToggleRow
          label="Request data export"
          sublabel="We will email an archive of your data within 30 days"
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
