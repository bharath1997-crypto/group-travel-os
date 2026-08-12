"use client";

import { useState } from "react";
import {
  getConsentPreferences,
  setConsentPreferences,
  type ConsentPreferences,
} from "@/lib/consent-storage";

export default function StoragePreferencesPanel() {
  const [prefs, setPrefs] = useState<ConsentPreferences>(() => getConsentPreferences());
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">Device storage preferences</h3>
      <p className="mt-1 text-sm text-stone-600">
        Control whether Rovvy may remember recent airport selections on this device across visits.
      </p>
      <div className="mt-3 space-y-2">
        <label className="flex min-h-11 items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={prefs.preferences === true}
            onChange={(e) => {
              setSaved(false);
              setPrefs((current) => ({ ...current, preferences: e.target.checked }));
            }}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
          <span>Remember recent airport selections (preference storage)</span>
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={prefs.analytics === true}
            onChange={(e) => {
              setSaved(false);
              setPrefs((current) => ({ ...current, analytics: e.target.checked }));
            }}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
          <span>Allow optional analytics when enabled</span>
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          setConsentPreferences({
            preferences: prefs.preferences ?? false,
            analytics: prefs.analytics ?? false,
          });
          setSaved(true);
        }}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Save storage preferences
      </button>
      {saved ? <p className="mt-2 text-xs font-medium text-teal-700">Preferences saved.</p> : null}
    </div>
  );
}
