/** Keys that must not leak across authenticated users on a shared browser. */

export const LS_AVATAR = "gt_avatar";
export const LS_AVATAR_USER_ID = "gt_avatar_user_id";

const SESSION_PROFILE_KEYS = [
  LS_AVATAR,
  LS_AVATAR_USER_ID,
  "gt_user_name",
  "gt_profile_avatar_url",
  "gt_profile_bio",
  "gt_profile_birthday",
  "gt_social_instagram",
  "gt_social_snapchat",
  "gt_social_whatsapp",
  "gt_share_map_location",
  "gt_stories_watched",
  "gt_saved_pins",
  "gt_daily_activity",
  "gt_favorite_trip_ids",
  "travello_streak_days",
  "travello_last_opened",
  "user",
  "travello_user",
] as const;

/** Client-only synthetic handles — never show while authenticated profile is loading. */
export const SYNTHETIC_GUEST_USERNAMES = new Set([
  "traveler_guest",
  "traveler_user",
  "guest",
]);

export function isSyntheticGuestUsername(
  username: string | null | undefined,
): boolean {
  if (!username?.trim()) return false;
  const u = username.trim().toLowerCase().replace(/^@/, "");
  if (SYNTHETIC_GUEST_USERNAMES.has(u)) return true;
  return /^traveler_[a-z0-9]{1,12}$/i.test(u);
}

/** Drop avatar customization when a different user signs in. */
export function bindAvatarStorageToUser(userId: string): void {
  if (typeof window === "undefined") return;
  const prev = localStorage.getItem(LS_AVATAR_USER_ID);
  if (prev && prev !== userId) {
    localStorage.removeItem(LS_AVATAR);
  }
  localStorage.setItem(LS_AVATAR_USER_ID, userId);
}

export function clearUserSessionStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of SESSION_PROFILE_KEYS) {
    localStorage.removeItem(key);
  }
}
