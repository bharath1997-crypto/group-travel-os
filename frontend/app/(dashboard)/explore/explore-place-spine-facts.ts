/** Place spine facts for Explore drawer (F50) — uses fetch, not api.ts. */

const SPINE_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export type ExplorePlaceFact = {
  key: string;
  value: string;
  source: string;
  source_url?: string | null;
  license: string;
  attribution: string;
};

export type ExplorePlaceSpinePayload = {
  gers_id: string;
  facts?: ExplorePlaceFact[];
};

export function firstParagraph(text: string): string {
  const raw = text.trim();
  if (!raw) return "";
  const idx = raw.search(/\n\s*\n/);
  return (idx >= 0 ? raw.slice(0, idx) : raw).trim();
}

export function factByKey(facts: ExplorePlaceFact[] | undefined, key: string): ExplorePlaceFact | null {
  if (!facts?.length) return null;
  return facts.find((f) => f.key === key) ?? null;
}

export function mergeHoursFromFacts(
  openingHours: string | null | undefined,
  hoursSource: string | null | undefined,
  facts: ExplorePlaceFact[] | undefined,
): { openingHours: string | null; hoursSource: string | null; osmCredit: string | null } {
  if (openingHours?.trim()) {
    return { openingHours, hoursSource: hoursSource ?? null, osmCredit: null };
  }
  const hoursFact = factByKey(facts, "opening_hours");
  if (!hoursFact?.value.trim()) {
    return { openingHours: null, hoursSource: null, osmCredit: null };
  }
  return {
    openingHours: hoursFact.value.trim(),
    hoursSource: "openstreetmap",
    osmCredit: hoursFact.attribution,
  };
}

export async function fetchExplorePlaceSpineFacts(gersId: string): Promise<ExplorePlaceFact[]> {
  const encoded = encodeURIComponent(gersId.trim());
  const res = await fetch(`${SPINE_API_BASE}/places/spine/${encoded}`, { credentials: "include" });
  if (!res.ok) return [];
  const data = (await res.json()) as ExplorePlaceSpinePayload;
  return Array.isArray(data.facts) ? data.facts : [];
}
