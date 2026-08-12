/**
 * Consent-aware browser storage for Rovvy preference data.
 *
 * - Necessary storage (auth tokens) is handled separately via gt_token.
 * - Preferences (recent airports, UI prefs) require explicit preference consent for localStorage.
 * - When preference consent is declined or undecided, preference data uses sessionStorage only.
 * - Analytics consent does not gate flight functionality.
 */

export type ConsentCategory = "necessary" | "preferences" | "analytics";

export type ConsentPreferences = {
  necessary: true;
  preferences: boolean | null;
  analytics: boolean | null;
  updatedAt: string;
};

const CONSENT_KEY = "rovvy.consent.preferences.v1";
const CONSENT_DISMISSED_KEY = "rovvy.consent.banner.dismissed.v1";

const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  preferences: null,
  analytics: null,
  updatedAt: "",
};

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function isBrowser(): boolean {
  return getLocalStorage() != null;
}

function readRaw(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // quota / private mode
  }
}

export function getConsentPreferences(): ConsentPreferences {
  const raw = readRaw(CONSENT_KEY);
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    return {
      necessary: true,
      preferences:
        typeof parsed.preferences === "boolean" ? parsed.preferences : null,
      analytics: typeof parsed.analytics === "boolean" ? parsed.analytics : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function setConsentPreferences(next: Pick<ConsentPreferences, "preferences" | "analytics">): ConsentPreferences {
  const merged: ConsentPreferences = {
    necessary: true,
    preferences: next.preferences,
    analytics: next.analytics,
    updatedAt: new Date().toISOString(),
  };
  writeRaw(CONSENT_KEY, JSON.stringify(merged));
  writeRaw(CONSENT_DISMISSED_KEY, "1");
  return merged;
}

export function acceptAllConsent(): ConsentPreferences {
  return setConsentPreferences({ preferences: true, analytics: true });
}

export function acceptNecessaryOnlyConsent(): ConsentPreferences {
  return setConsentPreferences({ preferences: false, analytics: false });
}

export function canUsePreferenceStorage(): boolean {
  return getConsentPreferences().preferences === true;
}

export function preferenceStorageBackend(): Storage | null {
  if (canUsePreferenceStorage()) return getLocalStorage();
  return getSessionStorage();
}

export function readPreferenceValue(key: string): string | null {
  const backend = preferenceStorageBackend();
  if (!backend) return null;
  try {
    return backend.getItem(key);
  } catch {
    return null;
  }
}

export function writePreferenceValue(key: string, value: string): void {
  const backend = preferenceStorageBackend();
  if (!backend) return;
  try {
    backend.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

export function removePreferenceValue(key: string): void {
  try {
    getLocalStorage()?.removeItem(key);
    getSessionStorage()?.removeItem(key);
  } catch {
    // ignore
  }
}

export function shouldShowConsentBanner(): boolean {
  if (!isBrowser()) return false;
  const prefs = getConsentPreferences();
  if (prefs.preferences !== null) return false;
  return readRaw(CONSENT_DISMISSED_KEY) !== "1";
}

export function dismissConsentBannerTemporarily(): void {
  writeRaw(CONSENT_DISMISSED_KEY, "1");
}

export function reopenConsentPreferences(): void {
  try {
    getLocalStorage()?.removeItem(CONSENT_DISMISSED_KEY);
  } catch {
    // ignore
  }
}
