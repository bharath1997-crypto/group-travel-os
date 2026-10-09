/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queueExploreMapCropSnapshotMock } = vi.hoisted(() => ({
  queueExploreMapCropSnapshotMock: vi.fn(async () => "data:image/png;base64,snap"),
}));

vi.mock("../explore-map-crop-snapshot", () => ({
  EXPLORE_MAP_CROP_ATTRIBUTION: "© OpenFreeMap © OpenStreetMap contributors",
  getCachedExploreMapCropSnapshot: () => null,
  queueExploreMapCropSnapshot: queueExploreMapCropSnapshotMock,
  resetExploreMapCropSnapshotStateForTests: () => {},
}));

import { ExploreMapCrop } from "../components/ExploreMapCrop";

describe("ExploreMapCrop", () => {
  beforeEach(() => {
    queueExploreMapCropSnapshotMock.mockClear();
    queueExploreMapCropSnapshotMock.mockResolvedValue("data:image/png;base64,snap");
  });

  it("replaces the live map host with a snapshot image, pin overlay, and attribution", async () => {
    render(<ExploreMapCrop lat={41.7508} lng={-88.1535} height={160} lazy={false} />);

    await waitFor(() => {
      expect(document.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,snap");
    });

    expect(document.querySelector('[class*="slotMapCropPin"]')).toBeTruthy();
    expect(screen.getByText(/OpenFreeMap/)).toBeTruthy();
    expect(document.querySelector(".maplibregl-map")).toBeNull();
  });

  it("queues a snapshot render when the crop mounts visible", async () => {
    render(<ExploreMapCrop lat={41.7508} lng={-88.1535} height={160} lazy={false} />);

    await waitFor(() => {
      expect(queueExploreMapCropSnapshotMock).toHaveBeenCalledTimes(1);
    });
  });
});
