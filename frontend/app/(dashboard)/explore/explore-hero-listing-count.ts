import type { ExploreHubLoadState } from "./explore-hub-fetch-state";

export type ExploreHeroListingCountState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "ready"; count: number };

export function deriveExploreHeroListingCountState(args: {
  loading: boolean;
  unexpectedError: boolean;
  hubLoadState?: ExploreHubLoadState;
  loadedScopeCount: number;
}): ExploreHeroListingCountState {
  if (args.loading) {
    return { phase: "loading" };
  }
  const coverageUnavailable =
    args.unexpectedError ||
    args.hubLoadState === "failed" ||
    (args.hubLoadState === "partial" && args.loadedScopeCount === 0);
  if (coverageUnavailable) {
    return { phase: "unavailable" };
  }
  return { phase: "ready", count: args.loadedScopeCount };
}

export function formatExploreHeroListingCountLine(state: ExploreHeroListingCountState): string {
  if (state.phase === "loading") return "Checking listings";
  if (state.phase === "unavailable") return "Listing count unavailable";
  if (state.count === 0) return "0 loaded listings";
  return `${state.count} loaded listings`;
}
