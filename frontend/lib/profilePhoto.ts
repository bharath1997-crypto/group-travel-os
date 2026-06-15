/**
 * Resolve which avatar URL should be shown as a profile photo (<img />),
 * excluding DiceBear SVGs, inline SVG data URLs, and raw emoji seeds.
 */

export function isDisplayableProfilePhotoUrl(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  if (u.length < 12) return false;
  const lower = u.toLowerCase();
  if (lower.includes("dicebear.com")) return false;
  if (
    lower.startsWith("data:image/svg+xml;base64,") ||
    lower.startsWith("data:image/svg+xml,")
  ) {
    return false;
  }
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:image/")
  );
}

export function resolveProfilePhotoUrl(user: {
  profile_picture?: string | null;
  avatar_url?: string | null;
} | null | undefined): string | null {
  if (!user) return null;
  const pp = user.profile_picture?.trim();
  if (pp && isDisplayableProfilePhotoUrl(pp)) return pp;
  const av = user.avatar_url?.trim();
  if (av && isDisplayableProfilePhotoUrl(av)) return av;
  return null;
}
