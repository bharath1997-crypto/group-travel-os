/** Open a verified provider URL from Explore listings (external handoff). */
export function openExploreListingUrl(url: string | null | undefined): boolean {
  const trimmed = (url || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  window.open(trimmed, "_blank", "noopener,noreferrer");
  return true;
}
