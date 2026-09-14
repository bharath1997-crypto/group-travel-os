import { describe, expect, it } from "vitest";
import { resolveLivePlaceMarkerAnchor } from "../live-map-place-marker";

describe("resolveLivePlaceMarkerAnchor", () => {
  it("anchors dropped pin preview at the map tip (bottom)", () => {
    expect(
      resolveLivePlaceMarkerAnchor({
        pinMode: "selected",
        navigationMode: false,
        pinLabel: "Dropped pin",
      }),
    ).toBe("bottom");
  });

  it("anchors navigation puck at center when no label", () => {
    expect(
      resolveLivePlaceMarkerAnchor({
        pinMode: "selected",
        navigationMode: true,
        pinLabel: null,
      }),
    ).toBe("center");
  });
});
