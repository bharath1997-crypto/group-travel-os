/** Assistant rows tied to a Live preview pin — removed when the preview card closes. */
export function isPreviewScopedWayraMessage(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("You picked")) return true;
  if (t.startsWith("Pin dropped.")) return true;
  if (t.includes("on the Live map at")) return true;
  if (t.startsWith("You're on Live with ") && t.includes("selected.")) return true;
  return false;
}
