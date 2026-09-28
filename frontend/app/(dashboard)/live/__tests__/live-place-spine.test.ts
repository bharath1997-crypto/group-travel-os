import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PLACE_SPINE_NEAR_RADIUS_M,
  fetchPlaceSpineNear,
  fetchPlaceSpineDetail,
} from "../live-place-spine";

vi.mock("@/lib/safe-fetch", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/safe-fetch";

describe("live-place-spine", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("fetchPlaceSpineDetail encodes gers_id path", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ gers_id: "abc" });
    await fetchPlaceSpineDetail("08f2664a1c2b3d4e5f6789012345678");
    expect(apiFetch).toHaveBeenCalledWith(
      "/places/spine/08f2664a1c2b3d4e5f6789012345678",
    );
  });

  it("fetchPlaceSpineNear uses default 50m radius", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ gers_id: "abc" });
    await fetchPlaceSpineNear(41.88, -87.63);
    expect(PLACE_SPINE_NEAR_RADIUS_M).toBe(50);
    expect(apiFetch).toHaveBeenCalledWith(
      "/places/spine/near?lat=41.88&lng=-87.63&radius_meters=50",
    );
  });

  it("fetchPlaceSpineNear accepts custom radius", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ gers_id: "abc" });
    await fetchPlaceSpineNear(41.88, -87.63, 120);
    expect(apiFetch).toHaveBeenCalledWith(
      "/places/spine/near?lat=41.88&lng=-87.63&radius_meters=120",
    );
  });
});
