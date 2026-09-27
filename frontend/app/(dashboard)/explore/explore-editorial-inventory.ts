/** Editorial / AI suggestion markers — never treat as verified Explore inventory. */

const GENERATED_SOURCE_EXACT = new Set([
  "ai",
  "ai_fallback",
  "editorial",
  "editorial_suggestions",
  "editorial_suggestion",
  "ai_seasonal",
]);

export function isEditorialExploreEventId(id: string | null | undefined): boolean {
  const value = (id || "").trim();
  return value.startsWith("ai-ev-") || value.startsWith("editorial-");
}

export function isEditorialExploreInventorySource(source: string | null | undefined): boolean {
  const raw = (source || "").trim().toLowerCase();
  if (!raw) return false;
  if (GENERATED_SOURCE_EXACT.has(raw)) return true;
  if (raw === "ai_fallback" || raw.includes("ai_fallback")) return true;
  if (raw.startsWith("ai_")) return true;
  if (raw.startsWith("editorial_") || raw.startsWith("editorial-")) return true;
  return false;
}

export function isEditorialExploreListing(
  source: string | null | undefined,
  id: string | null | undefined,
): boolean {
  return isEditorialExploreInventorySource(source) || isEditorialExploreEventId(id);
}

export type ExploreApiEventRow = {
  id?: string;
  source?: string;
  sourceType?: string;
};

export function isGeneratedExploreApiEventRow(event: ExploreApiEventRow): boolean {
  const source = event.source ?? event.sourceType;
  return isEditorialExploreListing(source, event.id);
}

export function filterVerifiedExploreApiEventRows<T extends ExploreApiEventRow>(rows: T[]): T[] {
  return rows.filter((event) => !isGeneratedExploreApiEventRow(event));
}
