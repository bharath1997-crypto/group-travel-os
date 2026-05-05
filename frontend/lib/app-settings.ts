import { apiFetch } from "@/lib/api";

export type SettingsCounts = {
  blocked: number;
  close_friends: number;
  muted: number;
  restricted: number;
  favorites: number;
};

export type SettingsAccountMeta = {
  subscription_plan: string;
  has_google: boolean;
  has_facebook: boolean;
  profile_public: boolean;
};

export type AppPreferences = Record<string, unknown>;

export type AppSettingsBundle = {
  preferences: AppPreferences;
  counts: SettingsCounts;
  account: SettingsAccountMeta;
};

export async function fetchAppSettings(): Promise<AppSettingsBundle> {
  return apiFetch<AppSettingsBundle>("/settings/app");
}

export async function patchAppSettings(
  preferences: AppPreferences,
): Promise<AppSettingsBundle> {
  return apiFetch<AppSettingsBundle>("/settings/app", {
    method: "PATCH",
    body: JSON.stringify({ preferences }),
  });
}

/** Nested helpers — preferences use deep merge on the server */
export function prefSection<T extends Record<string, unknown>>(
  prefs: AppPreferences,
  key: string,
): T {
  const v = prefs[key];
  return (typeof v === "object" && v !== null ? v : {}) as T;
}
