/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  exploreMapCropSnapshotCacheKey,
  getCachedExploreMapCropSnapshot,
  getExploreMapCropActiveRenderCountForTests,
  getExploreMapCropWaitQueueLengthForTests,
  resetExploreMapCropSnapshotStateForTests,
  testAcquireExploreMapCropRenderSlot,
  testReleaseExploreMapCropRenderSlot,
} from "../explore-map-crop-snapshot";

describe("explore-map-crop-snapshot", () => {
  it("builds stable cache keys from lat/lng/zoom", () => {
    resetExploreMapCropSnapshotStateForTests();
    expect(exploreMapCropSnapshotCacheKey(41.7508, -88.1535, 17)).toBe(
      "41.750800,-88.153500,17",
    );
    expect(getCachedExploreMapCropSnapshot(41.7508, -88.1535, 17)).toBeNull();
  });

  it("allows only two concurrent render slots; extra jobs wait in queue", async () => {
    resetExploreMapCropSnapshotStateForTests();

    const first = testAcquireExploreMapCropRenderSlot();
    const second = testAcquireExploreMapCropRenderSlot();
    const third = testAcquireExploreMapCropRenderSlot();

    expect(await first.whenReady).toBe(true);
    expect(await second.whenReady).toBe(true);
    expect(getExploreMapCropActiveRenderCountForTests()).toBe(2);

    let thirdReady: boolean | undefined;
    void third.whenReady.then((ready) => {
      thirdReady = ready;
    });
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    expect(thirdReady).toBeUndefined();
    expect(getExploreMapCropWaitQueueLengthForTests()).toBe(1);

    testReleaseExploreMapCropRenderSlot();
    expect(await third.whenReady).toBe(true);
    expect(getExploreMapCropActiveRenderCountForTests()).toBe(2);

    testReleaseExploreMapCropRenderSlot();
    testReleaseExploreMapCropRenderSlot();
    expect(getExploreMapCropActiveRenderCountForTests()).toBe(0);
  });

  it("cancelWait removes a queued job before it acquires a slot", async () => {
    resetExploreMapCropSnapshotStateForTests();

    testAcquireExploreMapCropRenderSlot();
    testAcquireExploreMapCropRenderSlot();
    const queued = testAcquireExploreMapCropRenderSlot();
    queued.cancelWait();

    expect(await queued.whenReady).toBe(false);
    expect(getExploreMapCropActiveRenderCountForTests()).toBe(2);

    testReleaseExploreMapCropRenderSlot();
    testReleaseExploreMapCropRenderSlot();
  });
});
