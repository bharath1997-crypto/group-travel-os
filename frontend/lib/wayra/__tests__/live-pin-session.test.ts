import { describe, expect, it } from "vitest";

import {
  extractLivePinKey,
  isLivePinScopedMessage,
  isLivePreviewPinContext,
  livePlacePinKey,
  withoutLivePinMessages,
} from "@/lib/wayra/live-pin-session";

describe("live pin session", () => {
  it("builds stable pin keys", () => {
    expect(livePlacePinKey(41.8781, -87.6298)).toBe("41.87810,-87.62980");
  });

  it("extracts pin key for preview and destination scopes only", () => {
    const ctx = {
      wayraScope: "place_preview",
      selectedPlace: { name: "Grant Park", lat: 41.87, lng: -87.62 },
    };
    expect(extractLivePinKey(ctx)).toBe("41.87000,-87.62000");
    expect(isLivePreviewPinContext(ctx)).toBe(true);
    expect(extractLivePinKey({ wayraScope: "gps_only" })).toBeNull();
  });

  it("removes only live-pin messages", () => {
    const rows = [
      { id: "1", role: "assistant", text: "Hi" },
      { id: "2", role: "user", text: "Q", livePinKey: "41.87000,-87.62000" },
      { id: "3", role: "assistant", text: "A", livePinKey: "41.87000,-87.62000" },
    ];
    expect(withoutLivePinMessages(rows)).toEqual([rows[0]]);
    expect(isLivePinScopedMessage(rows[1])).toBe(true);
    expect(isLivePinScopedMessage(rows[0])).toBe(false);
  });
});
