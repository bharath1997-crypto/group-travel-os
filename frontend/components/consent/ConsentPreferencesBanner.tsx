"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings2, ShieldCheck, X } from "lucide-react";
import {
  acceptAllConsent,
  acceptNecessaryOnlyConsent,
  dismissConsentBannerTemporarily,
  getConsentPreferences,
  setConsentPreferences,
  shouldShowConsentBanner,
  type ConsentPreferences,
} from "@/lib/consent-storage";

export default function ConsentPreferencesBanner() {
  const [visible, setVisible] = useState(() => shouldShowConsentBanner());
  const [customOpen, setCustomOpen] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPreferences>(() => getConsentPreferences());

  if (!visible) return null;

  const saveCustom = () => {
    setConsentPreferences({
      preferences: prefs.preferences ?? false,
      analytics: prefs.analytics ?? false,
    });
    setVisible(false);
    setCustomOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Storage preferences"
      className="fixed inset-x-0 bottom-0 z-[120] border-t border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-xl sm:rounded-2xl sm:border"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Storage preferences</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Rovvy can remember recent airport picks on this device when you allow preference storage.
            Flight search works either way.{" "}
            <Link href="/cookie-policy" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              Cookie Policy
            </Link>
          </p>

          {customOpen ? (
            <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex min-h-11 items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={prefs.preferences === true}
                  onChange={(e) =>
                    setPrefs((current) => ({ ...current, preferences: e.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>
                  <span className="font-medium">Preference storage</span>
                  <span className="block text-xs text-slate-500">
                    Save recent airport selections across visits (localStorage).
                  </span>
                </span>
              </label>
              <label className="flex min-h-11 items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={prefs.analytics === true}
                  onChange={(e) =>
                    setPrefs((current) => ({ ...current, analytics: e.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>
                  <span className="font-medium">Analytics</span>
                  <span className="block text-xs text-slate-500">
                    Optional usage analytics when Rovvy enables them.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveCustom}
                  className="inline-flex min-h-11 items-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Save preferences
                </button>
                <button
                  type="button"
                  onClick={() => setCustomOpen(false)}
                  className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  acceptAllConsent();
                  setVisible(false);
                }}
                className="inline-flex min-h-11 items-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => {
                  acceptNecessaryOnlyConsent();
                  setVisible(false);
                }}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Necessary only
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(true);
                  setPrefs(getConsentPreferences());
                }}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" />
                Customize
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            dismissConsentBannerTemporarily();
            setVisible(false);
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          aria-label="Dismiss for now"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
