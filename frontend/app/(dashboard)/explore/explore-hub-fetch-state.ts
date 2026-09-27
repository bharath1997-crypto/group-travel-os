/** G09/F07 — per-source and overall Explore hub load outcomes. */

export type ExploreSourceKey = "events" | "attractions" | "restaurants";

export type ExploreSourceLoadState = "ready" | "empty" | "failed";

export type ExploreHubLoadState = "ready" | "partial" | "empty" | "failed";

export type ExploreSourceStatusMap = Record<ExploreSourceKey, ExploreSourceLoadState>;

const SOURCE_LABELS: Record<ExploreSourceKey, string> = {
  events: "Events",
  attractions: "Attractions",
  restaurants: "Restaurants",
};

export type ExplorePlacesSourceStatus = "ready" | "empty" | "unavailable";

export function classifyExploreSourceLoadState(
  requestSucceeded: boolean,
  rowCount: number,
): ExploreSourceLoadState {
  if (!requestSucceeded) return "failed";
  if (rowCount <= 0) return "empty";
  return "ready";
}

/** `/explore/places` — distinguish successful empty inventory from unavailable spine. */
export function classifyExplorePlacesSourceLoadState(
  requestSucceeded: boolean,
  body: { places?: unknown[]; source_status?: ExplorePlacesSourceStatus } | null,
): ExploreSourceLoadState {
  if (!requestSucceeded) return "failed";
  const status = body?.source_status;
  if (status === "unavailable") return "failed";
  if (status === "empty") return "empty";
  if (status === "ready") return "ready";
  return classifyExploreSourceLoadState(true, body?.places?.length ?? 0);
}

export function deriveExploreHubLoadState(
  sourceStatus: ExploreSourceStatusMap,
  inventoryCount: number,
): ExploreHubLoadState {
  const states = Object.values(sourceStatus);
  const failedCount = states.filter((s) => s === "failed").length;
  const succeededCount = states.filter((s) => s !== "failed").length;

  if (failedCount === states.length) return "failed";
  if (failedCount > 0 && succeededCount > 0) return "partial";
  if (succeededCount === states.length && inventoryCount <= 0) return "empty";
  if (inventoryCount > 0 && failedCount === 0) return "ready";
  if (inventoryCount > 0 && failedCount > 0) return "partial";
  return "empty";
}

export function failedExploreSourceLabels(sourceStatus: ExploreSourceStatusMap): ExploreSourceKey[] {
  return (Object.keys(sourceStatus) as ExploreSourceKey[]).filter(
    (key) => sourceStatus[key] === "failed",
  );
}

export function formatPartialSourceFailureLine(
  sourceStatus: ExploreSourceStatusMap,
  survivingSlotCount: number,
): string {
  const labels = failedExploreSourceLabels(sourceStatus).map((key) => SOURCE_LABELS[key]);
  if (!labels.length) return "";
  const tail =
    survivingSlotCount > 0
      ? "Showing available results."
      : "Available sources returned no listings.";
  return `Some listing sources couldn’t load: ${labels.join(" · ")}. ${tail}`;
}

export function shouldApplyExploreHubResponse(requestSeq: number, activeSeq: number): boolean {
  return requestSeq === activeSeq;
}
