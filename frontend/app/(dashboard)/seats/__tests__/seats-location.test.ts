import { describe, expect, it } from "vitest";
import {
  formatSeatShareReverseAddress,
  isOriginSearchReady,
  PROMPT_FROM,
} from "../seats-location";

describe("formatSeatShareReverseAddress", () => {
  it("prefers house number and road over POI display_name", () => {
    const label = formatSeatShareReverseAddress(
      {
        display_name: "Shell, 2003, Main Road, Pune, India",
        name: "Shell",
        class: "amenity",
        type: "fuel",
        address: { house_number: "2003", road: "Main Road", city: "Pune" },
      },
      18.59,
      73.73,
    );
    expect(label).toBe("2003 Main Road, Pune");
    expect(label).not.toContain("Shell");
  });

  it("uses coordinates when reverse is a POI without street", () => {
    const label = formatSeatShareReverseAddress(
      {
        display_name: "Shell, 2003, Pune",
        name: "Shell",
        class: "amenity",
        type: "fuel",
        address: { city: "Pune" },
      },
      18.59123,
      73.73891,
    );
    expect(label).toBe("18.59123, 73.73891");
  });

  it("formats road-only address when no house number", () => {
    const label = formatSeatShareReverseAddress(
      {
        display_name: "Some Road, Mumbai",
        address: { road: "Link Road", suburb: "Andheri" },
      },
      19.11,
      72.87,
    );
    expect(label).toBe("Link Road, Andheri");
  });
});

describe("isOriginSearchReady", () => {
  it("blocks search until origin is confirmed", () => {
    expect(isOriginSearchReady(PROMPT_FROM)).toBe(false);
    expect(isOriginSearchReady({ ...PROMPT_FROM, isConfirmed: true, source: "map_pin" })).toBe(
      true,
    );
  });
});
