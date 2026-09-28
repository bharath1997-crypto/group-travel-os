/**
 * DiceBear Initials SVG URL for a stable avatar from a seed (e.g. display name).
 */
export function dicebearAvatarSvgUrl(seed: string): string {
  const s = seed.trim() || "?";
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s)}`;
}
