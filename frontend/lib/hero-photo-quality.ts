/** Shared hero photo filtering and ranking rules for Explore. */

export type HeroPhotoCandidate = {
  url: string;
  width: number | null;
  height: number | null;
  credit: string | null;
  creditUrl: string | null;
  lat: number | null;
  lon: number | null;
  dominantColor: string | null;
  title: string;
  description: string;
  entityLabel: string;
  source: "wikidata" | "commons" | "flickr";
  assessmentRank: number;
};

export const PHOTO_RADIUS_TIERS_KM = [2, 8, 25] as const;
export const MIN_PHOTO_WIDTH = 1800;
export const MIN_PHOTO_ASPECT = 1.5;
export const MAX_PHOTO_ASPECT = 3.0;
export const MIN_TIER_SURVIVORS = 3;

export const BLOCKED_PHOTO_TERMS = [
  "walgreens",
  "cvs",
  "walmart",
  "target",
  "mcdonald",
  "starbucks",
  "dunkin",
  "subway restaurant",
  "store",
  "storefront",
  "shop front",
  "pharmacy",
  "strip mall",
  "retail",
  "plaza",
  "parking",
  "parking lot",
  "garage",
  "gas station",
  "petrol",
  "drive-thru",
  "drive thru",
  "car park",
  "intersection",
  "crossroads",
  "street view",
  "streetview",
  "road sign",
  "signage",
  "sign",
  "traffic",
  "traffic light",
  "utility pole",
  "power line",
  "sidewalk",
  "pavement",
  "kerb",
  "curb",
  "construction",
  "scaffolding",
  "roadworks",
  "demolition",
  "vacant",
  "for sale",
  "for lease",
  "map",
  "diagram",
  "plan",
  "chart",
  "logo",
  "plaque",
  "historical marker",
  "memorial plaque",
  "interior",
  "indoor",
  "closeup",
  "close-up",
  "macro",
  "portrait",
  "selfie",
  "crowd",
  "protest",
  "mugshot",
  "screenshot",
  "panorama stitch",
  "mapillary",
  "google street",
];

export const POSITIVE_SUBJECT_TERMS = [
  "skyline",
  "waterfront",
  "lakefront",
  "riverwalk",
  "park",
  "bridge",
  "theatre",
  "theater",
  "museum",
  "plaza",
  "square",
  "historic",
  "landmark",
  "boulevard",
  "avenue at dusk",
  "aerial",
  "panorama",
  "beach",
  "harbour",
  "harbor",
  "pier",
  "garden",
  "mural",
  "architecture",
];

const LOW_QUALITY_CATEGORY_MARKERS = [
  "images needing rotation",
  "blurry",
  "low quality",
];

const QUALITY_ASSESSMENT_ORDER = [
  "featured picture",
  "quality image",
  "valued image",
];

export function normalizePhotoText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function blockedPhotoText(...parts: Array<string | null | undefined>): boolean {
  const haystack = normalizePhotoText(parts.filter(Boolean).join(" "));
  if (!haystack) return false;
  return BLOCKED_PHOTO_TERMS.some((term) => {
    if (term.includes(" ")) return haystack.includes(term);
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  });
}

export function positiveSubjectScore(...parts: Array<string | null | undefined>): number {
  const haystack = normalizePhotoText(parts.filter(Boolean).join(" "));
  return POSITIVE_SUBJECT_TERMS.reduce(
    (score, term) => (haystack.includes(term) ? score + 1 : score),
    0,
  );
}

export function qualityAssessmentRank(metadata: Record<string, { value?: unknown }>): number {
  const assessments = normalizePhotoText(stripHtml(metadata.Assessments?.value) ?? "");
  const categories = normalizePhotoText(stripHtml(metadata.Categories?.value) ?? "");
  const combined = `${assessments} ${categories}`;
  for (let index = 0; index < QUALITY_ASSESSMENT_ORDER.length; index += 1) {
    if (combined.includes(QUALITY_ASSESSMENT_ORDER[index])) {
      return QUALITY_ASSESSMENT_ORDER.length - index;
    }
  }
  return 0;
}

export function lowQualityMetadata(metadata: Record<string, { value?: unknown }>): boolean {
  const quality = normalizePhotoText(stripHtml(metadata.Quality?.value) ?? stripHtml(metadata.Assessment?.value) ?? "");
  if (quality.includes("low")) return true;
  const categories = normalizePhotoText(stripHtml(metadata.Categories?.value) ?? "");
  return LOW_QUALITY_CATEGORY_MARKERS.some((marker) => categories.includes(marker));
}

export function stripHtml(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return clean || null;
}

export function passesTechnicalBar(width: number | null, height: number | null): boolean {
  if (width === null || height === null || width < MIN_PHOTO_WIDTH || height <= 0) return false;
  const aspect = width / height;
  return aspect >= MIN_PHOTO_ASPECT && aspect <= MAX_PHOTO_ASPECT;
}

export function rankPhotoCandidates(candidates: HeroPhotoCandidate[]): HeroPhotoCandidate[] {
  return [...candidates].sort((left, right) => {
    const qualityDelta = right.assessmentRank - left.assessmentRank;
    if (qualityDelta !== 0) return qualityDelta;
    const sourceDelta = (right.source === "wikidata" ? 1 : 0) - (left.source === "wikidata" ? 1 : 0);
    if (sourceDelta !== 0) return sourceDelta;
    const subjectDelta =
      positiveSubjectScore(right.title, right.description, right.entityLabel) -
      positiveSubjectScore(left.title, left.description, left.entityLabel);
    if (subjectDelta !== 0) return subjectDelta;
    return (right.width ?? 0) - (left.width ?? 0);
  });
}

export function deterministicIndex(seed: string, length: number): number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return Math.abs(hash) % length;
}

export function chooseRankedPhoto(candidates: HeroPhotoCandidate[], seed: string): HeroPhotoCandidate | null {
  if (!candidates.length) return null;
  const ranked = rankPhotoCandidates(candidates);
  return ranked[deterministicIndex(seed, ranked.length)] ?? null;
}

export function roundedCoordinateKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

export function commonsFilenameFromValue(imageValue: string): string {
  const trimmed = imageValue.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http")) {
    const match = trimmed.match(/\/wiki\/File:(.+)$/i);
    return match ? decodeURIComponent(match[1].replace(/_/g, " ")) : "";
  }
  return trimmed;
}

export function commonsFilePathUrl(filename: string, width = 2880): string | null {
  const normalized = filename.trim();
  if (!normalized) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized.replace(/ /g, "_"))}?width=${width}`;
}
