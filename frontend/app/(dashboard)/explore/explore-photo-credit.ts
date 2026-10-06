import type { ExplorePhotoCredit } from "./explore-fixtures";

/** "Photo: Mahir256 · Wikimedia Commons · CC BY-SA 3.0" — author + license, as CC licenses require. */
export function photoCreditText(credit: ExplorePhotoCredit): string {
  const parts = [credit.attribution, credit.license].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length ? `Photo: ${parts.join(" · ")}` : "Photo credit unavailable";
}
