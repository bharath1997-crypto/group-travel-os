import { describe, expect, it } from "vitest";
import {
  buildDiscoveryCatsParam,
  DISCOVERY_LAYER_DEFAULT_KEYS,
} from "../live-map-discovery-categories";

describe("live-map-discovery-categories", () => {
  it("builds comma-separated api param", () => {
    expect(buildDiscoveryCatsParam(["parks", "capitals"])).toBe("parks,capitals");
  });

  it("falls back to defaults when empty", () => {
    expect(buildDiscoveryCatsParam([])).toBe(DISCOVERY_LAYER_DEFAULT_KEYS.join(","));
  });
});
