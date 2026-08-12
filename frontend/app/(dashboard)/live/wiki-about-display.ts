/** Labels for Wikipedia About-tab match quality (QA: entity mismatch disclosure). */

export type WikiSummaryLike = {
  available?: boolean;
  summary?: string;
  title?: string;
  url?: string;
  matchedOn?: string;
  approximate?: boolean;
};

export type WikiAboutPresentation = {
  badge: string;
  badgeClass: string;
  heading: string;
  disclaimer: string | null;
};

export function presentWikiAbout(
  wiki: WikiSummaryLike,
  placeName: string,
  city?: string | null,
): WikiAboutPresentation {
  const matchedOn = wiki.matchedOn || "place";
  const title = wiki.title?.trim() || city || placeName || "this area";
  const approximate = wiki.approximate === true || matchedOn !== "place";

  if (matchedOn === "nearby") {
    return {
      badge: "Area info",
      badgeClass: "bg-amber-100 text-amber-900",
      heading: `Nearby landmark — not this exact address`,
      disclaimer: `No Wikipedia article matched "${placeName}" exactly. Showing the closest mapped article: ${title}.`,
    };
  }

  if (matchedOn === "city" || matchedOn === "region") {
    return {
      badge: "Area info",
      badgeClass: "bg-amber-100 text-amber-900",
      heading: `About the surrounding area — ${title}`,
      disclaimer: `No article for this exact pin. This describes the wider area, not "${placeName}" specifically.`,
    };
  }

  if (approximate) {
    return {
      badge: "Area info",
      badgeClass: "bg-amber-100 text-amber-900",
      heading: `About ${title}`,
      disclaimer: "Matched approximately — verify on Wikipedia if this is the exact place you selected.",
    };
  }

  return {
    badge: "Verified source",
    badgeClass: "bg-teal-50 text-primary",
    heading: "About",
    disclaimer: null,
  };
}

export const LIVE_DATA_DISCLAIMER =
  "Hours, prices, and live booking are not connected — verify on official sites before you go.";

export const WAYRA_DATA_DISCLAIMER =
  "Wayra uses map context, OpenStreetMap, and Wikipedia — not live booking or hours feeds.";

export function wikiAboutEmptyCopy(placeName: string, city?: string | null): string {
  const where = city ? `"${placeName}" in ${city}` : `"${placeName}"`;
  return `We could not match ${where} to a specific Wikipedia article.`;
}
