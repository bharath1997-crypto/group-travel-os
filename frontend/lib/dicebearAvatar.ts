/**
 * DiceBear Lorelei SVG URL for a stable avatar from a seed (e.g. display name).
 */
export function dicebearAvatarSvgUrl(seed: string): string {
  const s = seed.trim() || "?";
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(s)}`;
}
