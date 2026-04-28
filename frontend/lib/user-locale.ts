import type { AppPreferences } from "@/lib/app-settings";

const LS_CURRENCY = "gt_preferred_currency";
const LS_TZ = "gt_timezone";

export function getPreferredCurrency(): string {
  if (typeof window === "undefined") return "INR";
  const raw = localStorage.getItem(LS_CURRENCY);
  const c = (raw || "INR").trim().toUpperCase();
  return c.length >= 3 ? c.slice(0, 10) : "INR";
}

export function getPreferredTimezone(): string {
  if (typeof window === "undefined") return "UTC";
  const raw = localStorage.getItem(LS_TZ);
  if (raw?.trim()) return raw.trim();
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Call after PATCH /settings/app or when loading GET /settings/app so splits use your defaults offline-first. */
export function syncLocaleFromAppPreferences(prefs: AppPreferences): void {
  if (typeof window === "undefined") return;
  const loc = prefs.locale;
  if (!loc || typeof loc !== "object") return;
  const o = loc as { preferred_currency?: string; timezone?: string };
  if (o.preferred_currency?.trim()) {
    localStorage.setItem(
      LS_CURRENCY,
      o.preferred_currency.trim().toUpperCase().slice(0, 10),
    );
  }
  if (o.timezone?.trim()) {
    localStorage.setItem(LS_TZ, o.timezone.trim());
  }
}

export function applyLocaleToLocalStorage(
  currency: string,
  timezone: string,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    LS_CURRENCY,
    currency.trim().toUpperCase().slice(0, 10) || "INR",
  );
  localStorage.setItem(LS_TZ, timezone.trim() || "UTC");
}
