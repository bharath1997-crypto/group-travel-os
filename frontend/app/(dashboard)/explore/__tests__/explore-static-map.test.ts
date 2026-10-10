/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import { disposeExploreStaticMap } from "../explore-static-map";

describe("disposeExploreStaticMap", () => {
  it("swallows map.remove errors when the container is already detached", () => {
    const container = document.createElement("div");
    const map = {
      remove: vi.fn(() => {
        throw new TypeError("Cannot read properties of null (reading 'removeChild')");
      }),
    };
    const marker = { remove: vi.fn() };

    expect(() =>
      disposeExploreStaticMap(map as never, container, marker as never, undefined),
    ).not.toThrow();

    expect(marker.remove).toHaveBeenCalled();
    expect(map.remove).toHaveBeenCalled();
  });
});
