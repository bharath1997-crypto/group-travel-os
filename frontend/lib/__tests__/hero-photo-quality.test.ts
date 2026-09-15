import { describe, expect, it } from "vitest";

import {
  blockedPhotoText,
  chooseRankedPhoto,
  passesTechnicalBar,
  positiveSubjectScore,
  rankPhotoCandidates,
  type HeroPhotoCandidate,
} from "@/lib/hero-photo-quality";

function candidate(overrides: Partial<HeroPhotoCandidate>): HeroPhotoCandidate {
  return {
    url: "https://example.com/photo.jpg",
    width: 2400,
    height: 1200,
    credit: "Photo, CC BY",
    creditUrl: "https://example.com",
    lat: 41.88,
    lon: -87.63,
    dominantColor: "#2A3A34",
    title: "Chicago skyline at dusk",
    description: "City skyline from the lakefront",
    entityLabel: "Chicago",
    source: "wikidata",
    assessmentRank: 0,
    ...overrides,
  };
}

describe("hero photo quality gates", () => {
  it("blocks retail and street-view subjects", () => {
    expect(blockedPhotoText("Walgreens store at intersection.jpg")).toBe(true);
    expect(blockedPhotoText("Parking lot near downtown")).toBe(true);
    expect(blockedPhotoText("Chicago skyline at dusk")).toBe(false);
  });

  it("does not block architecture titles that merely contain blocked substrings", () => {
    expect(blockedPhotoText("Modern civic design pavilion")).toBe(false);
  });

  it("enforces the technical bar", () => {
    expect(passesTechnicalBar(1799, 1000)).toBe(false);
    expect(passesTechnicalBar(1800, 1200)).toBe(true);
    expect(passesTechnicalBar(2400, 1800)).toBe(false);
  });

  it("ranks quality-assessed and subject-positive photos first", () => {
    const ranked = rankPhotoCandidates([
      candidate({ title: "Street corner", assessmentRank: 0, source: "commons" }),
      candidate({ title: "Chicago skyline", assessmentRank: 3, source: "wikidata" }),
    ]);
    expect(ranked[0]?.title).toBe("Chicago skyline");
    expect(positiveSubjectScore("Grant Park waterfront")).toBeGreaterThan(0);
  });

  it("picks deterministically from ranked survivors", () => {
    const first = chooseRankedPhoto(
      [candidate({ title: "A" }), candidate({ title: "B" })],
      "chicago:2026-09-11:day",
    );
    const second = chooseRankedPhoto(
      [candidate({ title: "A" }), candidate({ title: "B" })],
      "chicago:2026-09-11:day",
    );
    expect(first?.title).toBe(second?.title);
  });
});
