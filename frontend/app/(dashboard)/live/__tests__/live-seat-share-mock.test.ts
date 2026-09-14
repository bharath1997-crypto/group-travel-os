import { describe, expect, it } from "vitest";
import {
  buildDefaultSeatShare,
  buildSeatShareOpenedNotice,
  seatShareOpenSeats,
} from "../live-seat-share-mock";

describe("live-seat-share-mock", () => {
  it("tracks open seats across vehicles", () => {
    const share = buildDefaultSeatShare("Union Station");
    expect(seatShareOpenSeats(share)).toBe(3);
    expect(share.destinationName).toBe("Union Station");
  });

  it("formats the seat share opened notice", () => {
    expect(buildSeatShareOpenedNotice(3, "Union Station")).toBe(
      "3 seats open to Union Station",
    );
  });
});
