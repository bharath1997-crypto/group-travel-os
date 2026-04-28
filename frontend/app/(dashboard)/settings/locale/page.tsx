"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";
import { apiFetch } from "@/lib/api";
import { applyLocaleToLocalStorage } from "@/lib/user-locale";

import { SettingsScreenHeader, SettingsSectionTitle } from "../_components";

type CurrencyRow = { code: string; name: string; symbol: string };

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Dubai",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const;

export default function SettingsLocalePage() {
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    setLoading(true);
    try {
      const [curRes, bundle] = await Promise.all([
        apiFetch<CurrencyRow[]>("/currencies"),
        fetchAppSettings(),
      ]);
      setCurrencies(curRes);
      const loc = prefSection<Record<string, string>>(bundle.preferences, "locale");
      const c = (loc.preferred_currency || "INR").toUpperCase();
      setCurrency(c.length >= 3 ? c.slice(0, 10) : "INR");
      setTimezone(loc.timezone?.trim() || "UTC");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      await patchAppSettings({
        locale: {
          preferred_currency: currency.toUpperCase().slice(0, 10),
          timezone: timezone.trim() || "UTC",
        },
      });
      applyLocaleToLocalStorage(currency, timezone);
      setMsg("Saved. New expenses default to this currency.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SettingsScreenHeader title="Currency & time zone" backHref="/settings" />
      <div className="px-4 py-3 text-sm text-stone-600">
        Trip expenses still require a currency on each receipt; this is your
        default for Split activities and trip expense forms. Time zone is used
        for displaying dates and summaries in your region.
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      ) : (
        <>
          <SettingsSectionTitle>Default currency</SettingsSectionTitle>
          <div className="border-b border-stone-100 px-4 py-3">
            <label className="text-xs font-semibold text-stone-500">
              Preferred code
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
            >
              {currencies.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.code} — {row.name} ({row.symbol})
                </option>
              ))}
            </select>
          </div>
          <SettingsSectionTitle>Time zone</SettingsSectionTitle>
          <div className="border-b border-stone-100 px-4 py-3">
            <label className="text-xs font-semibold text-stone-500">
              IANA time zone
            </label>
            <input
              list="gt-timezone-options"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Asia/Kolkata"
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
            <datalist id="gt-timezone-options">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
          {msg ? (
            <p
              className={`mx-4 mt-3 text-sm ${msg.includes("Saved") ? "text-emerald-600" : "text-red-600"}`}
            >
              {msg}
            </p>
          ) : null}
          <div className="px-4 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="w-full rounded-xl bg-[#E94560] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
