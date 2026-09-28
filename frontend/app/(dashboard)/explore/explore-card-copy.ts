/** Avoid repeating the listing title in the summary line beneath it. */
export function normalizeCardSummary(title: string, summary: string | undefined): string | undefined {
  const t = title.trim();
  const s = (summary || "").trim();
  if (!s) return undefined;
  if (!t) return s;
  if (s === t) return undefined;
  const prefix = `${t} ·`;
  if (s.startsWith(prefix)) {
    const rest = s.slice(prefix.length).trim();
    return rest || undefined;
  }
  return s;
}

/** Card footer rating — omit placeholder when providers supply no verified score. */
export function cardRatingDisplay(rating: string | undefined): string | undefined {
  const r = (rating || "").trim();
  if (!r || r === "—" || r.startsWith("—")) return undefined;
  return r;
}

/** Count how many primary title strings would render (for regression tests). */
export function exploreCardTitleRenderCount(input: {
  overlayTitle?: boolean;
  title: string;
  summary?: string;
}): number {
  let count = 1;
  const summary = normalizeCardSummary(input.title, input.summary);
  if (summary === input.title.trim()) count += 1;
  return count;
}
