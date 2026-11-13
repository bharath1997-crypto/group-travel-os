import { describe, expect, it, vi } from "vitest";
import { removeSeatShareRouteLayers } from "../seats-route-map-sync";

describe("removeSeatShareRouteLayers", () => {
  it("does not throw when getLayer fails after map teardown", () => {
    const map = {
      getLayer: vi.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'getLayer')");
      }),
      removeLayer: vi.fn(),
      getSource: vi.fn(() => true),
      removeSource: vi.fn(),
    };

    expect(() => removeSeatShareRouteLayers(map as never)).not.toThrow();
  });

  it("removes layers and source on a live map", () => {
    const layers = new Set(["seats-route-line-0", "seats-route-line-1"]);
    const map = {
      getLayer: vi.fn((id: string) => layers.has(id)),
      removeLayer: vi.fn((id: string) => {
        layers.delete(id);
      }),
      getSource: vi.fn(() => true),
      removeSource: vi.fn(),
    };

    removeSeatShareRouteLayers(map as never);
    expect(map.removeLayer).toHaveBeenCalled();
    expect(map.removeSource).toHaveBeenCalledWith("seats-routes");
  });

  it("no-ops for null map", () => {
    expect(() => removeSeatShareRouteLayers(null)).not.toThrow();
  });
});
