/**
 * Local cache for profile bits used before / without a fresh /auth/me fetch (e.g. map avatar ring).
 */

const AVATAR_URL_KEY = "gt_profile_avatar_url";

export type ProfileCacheUser = {
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
};

export function syncLocalProfileCache(user: ProfileCacheUser): void {
  if (typeof window === "undefined") return;
  const u = user.avatar_url?.trim();
  if (u) {
    localStorage.setItem(AVATAR_URL_KEY, u);
  } else {
    localStorage.removeItem(AVATAR_URL_KEY);
  }
}

export function getCachedProfileAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AVATAR_URL_KEY);
}

export function clearLocalProfileCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AVATAR_URL_KEY);
}
