import { describe, expect, it } from "vitest";

import {
  buildCategorySubtitle,
  buildCta,
  buildDetailRows,
  buildPhotoGrid,
  buildPlacePanelSections,
  formatHoldSeatsLabel,
  formatProvenance,
  hasGroupReviewData,
  isSheetViewport,
  orderGroupTags,
  resolveMediaMode,
  shouldShowLivePreviewChrome,
  truncateGersId,
} from "../place-panel-display";
import {
  PLACE_PANEL_FIXTURE_DISTANCE,
  PLACE_PANEL_FIXTURE_TIER0,
  PLACE_PANEL_FIXTURE_TIER1,
  PLACE_PANEL_FIXTURE_TIER2,
} from "../place-panel-fixtures";
import { buildMapCropTileUrl, lonLatToTile } from "../place-panel-map-tile";

describe("place-panel acceptance fixtures", () => {
  it("case 1 — tier 0: map crop, 2 detail rows, dashed first-review block", () => {
    const sections = buildPlacePanelSections(PLACE_PANEL_FIXTURE_TIER0, {
      distance: PLACE_PANEL_FIXTURE_DISTANCE,
    });

    expect(sections.mediaMode).toBe("map-crop");
    expect(sections.detailRows).toHaveLength(2);
    expect(sections.detailRows.map((row) => row.kind)).toEqual(["address", "distance"]);
    expect(sections.cta?.kind).toBe("tier0-empty");
    expect(sections.showDescription).toBe(false);
    expect(sections.showGroupTags).toBe(false);
    expect(sections.showLatestReview).toBe(false);
    expect(sections.showRollUp).toBe(false);
    expect(formatProvenance(PLACE_PANEL_FIXTURE_TIER0)).toContain("overture · gers");
  });

  it("case 2 — tier 1: claimed, description, 3 detail rows, Ask block", () => {
    const sections = buildPlacePanelSections(PLACE_PANEL_FIXTURE_TIER1);

    expect(sections.mediaMode).toBe("map-crop");
    expect(sections.showClaimedBadge).toBe(true);
    expect(sections.showDescription).toBe(true);
    expect(sections.detailRows).toHaveLength(3);
    expect(sections.detailRows.map((row) => row.kind)).toEqual(["hours", "address", "instagram"]);
    expect(sections.cta?.kind).toBe("tier1-empty");
    expect(sections.cta?.kind).not.toBe("hold-seats");
  });

  it("case 3 — tier 2: photo grid +11, roll-up, Hold seats", () => {
    const sections = buildPlacePanelSections(PLACE_PANEL_FIXTURE_TIER2, { groupSize: 6 });

    expect(sections.mediaMode).toBe("grid");
    expect(buildPhotoGrid(PLACE_PANEL_FIXTURE_TIER2.photos).overflow).toBe(11);
    expect(sections.showRollUp).toBe(true);
    expect(sections.showGroupTags).toBe(true);
    expect(sections.showLatestReview).toBe(true);
    expect(sections.cta?.kind).toBe("hold-seats");
    expect(formatHoldSeatsLabel(6, PLACE_PANEL_FIXTURE_TIER2.next_slot)).toMatch(/Hold 6 seats ·/);
    expect(sections.showSlotsChip).toBe(true);
  });

  it("case 4 — 390px viewport uses sheet layout breakpoint", () => {
    expect(isSheetViewport(390)).toBe(true);
    expect(isSheetViewport(640)).toBe(false);
  });
});

describe("place-panel-display helpers", () => {
  it("uses field presence for CTAs — not depth_tier integer", () => {
    expect(
      buildCta(
        {
          bookable: true,
          next_slot: null,
          short_description: null,
          hours: null,
          claimed: false,
          instagram: null,
          website: null,
          photos: [],
          review_count: 0,
          group_tags: [],
          latest_review: null,
          would_return_pct: null,
        },
        6,
      )?.kind,
    ).toBe("tier0-empty");

    expect(
      buildCta(
        {
          bookable: true,
          next_slot: "2026-09-17T21:30:00.000Z",
          short_description: "Nice spot",
          hours: { is_open: true, closes_at: "22:00" },
          claimed: true,
          instagram: "venue",
          website: null,
          photos: [],
          review_count: 0,
          group_tags: [],
          latest_review: null,
          would_return_pct: null,
        },
        6,
      )?.kind,
    ).toBe("hold-seats");

    expect(
      buildCta(
        {
          bookable: false,
          next_slot: null,
          short_description: "Wine bar",
          hours: { is_open: true, closes_at: "22:00" },
          claimed: true,
          instagram: "lumen",
          website: null,
          photos: [],
          review_count: 0,
          group_tags: [],
          latest_review: null,
          would_return_pct: null,
        },
        6,
      )?.kind,
    ).toBe("tier1-empty");
  });

  it("renders rich media when photos exist even if depth_tier is stale 0", () => {
    const staleRich = {
      ...PLACE_PANEL_FIXTURE_TIER0,
      depth_tier: 0 as const,
      short_description: "Hidden gem",
      hours: { is_open: true, closes_at: "22:00" },
      photos: PLACE_PANEL_FIXTURE_TIER2.photos.slice(0, 3),
    };
    const sections = buildPlacePanelSections(staleRich);
    expect(sections.mediaMode).toBe("grid");
    expect(sections.showDescription).toBe(true);
    expect(hasGroupReviewData(staleRich)).toBe(false);
  });

  it("keeps warn tags in source order", () => {
    const tags = orderGroupTags(PLACE_PANEL_FIXTURE_TIER2.group_tags);
    expect(tags.findIndex((tag) => tag.tone === "warn")).toBe(4);
    expect(tags[4]?.label).toBe("Stairs only");
  });

  it("builds category subtitle with neighborhood", () => {
    expect(buildCategorySubtitle(PLACE_PANEL_FIXTURE_TIER2)).toBe("Cocktail bar · Logan Square");
    expect(
      buildCategorySubtitle({ category_label: "Place", neighborhood: null }, "Rajasthan"),
    ).toBe("Place · Rajasthan");
  });

  it("shows live preview chrome only on thin mobile sheet rows", () => {
    const tier0 = buildPlacePanelSections(PLACE_PANEL_FIXTURE_TIER0);
    const tier2 = buildPlacePanelSections(PLACE_PANEL_FIXTURE_TIER2, { groupSize: 6 });
    expect(shouldShowLivePreviewChrome(tier0, true)).toBe(true);
    expect(shouldShowLivePreviewChrome(tier0, false)).toBe(false);
    expect(shouldShowLivePreviewChrome(tier2, true)).toBe(false);
  });

  it("builds z17 map crop url on Rovvy tile Worker", () => {
    const tile = lonLatToTile(PLACE_PANEL_FIXTURE_TIER0.lon, PLACE_PANEL_FIXTURE_TIER0.lat, 17);
    expect(tile.z).toBe(17);
    const url = buildMapCropTileUrl(PLACE_PANEL_FIXTURE_TIER0.lat, PLACE_PANEL_FIXTURE_TIER0.lon);
    expect(url).toContain(`tiles.rovvy.app/t/17/${tile.x}/${tile.y}`);
    expect(url).not.toContain("openstreetmap.org");
  });

  it("truncates gers id for tier-0 provenance", () => {
    expect(truncateGersId("08f2664a1c2b3d4e5f6789012345678")).toBe("08f2664a…678");
  });

  it("omits distance row when distance is unavailable", () => {
    const rows = buildDetailRows(PLACE_PANEL_FIXTURE_TIER0, null);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("address");
  });

  it("resolves media mode from photo count", () => {
    expect(resolveMediaMode([])).toBe("map-crop");
    expect(resolveMediaMode([PLACE_PANEL_FIXTURE_TIER2.photos[0]!])).toBe("single");
    expect(resolveMediaMode(PLACE_PANEL_FIXTURE_TIER2.photos)).toBe("grid");
  });
});
