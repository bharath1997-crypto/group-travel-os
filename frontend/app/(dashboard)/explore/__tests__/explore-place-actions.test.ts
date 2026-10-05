import { describe, expect, it } from "vitest";

import { explorePhoneHref } from "../explore-place-actions";

describe("explorePhoneHref", () => {
  it("builds a dialable tel: link", () => {
    expect(explorePhoneHref("+1 (312) 555-0100")).toBe("tel:+13125550100");
  });

  it("rejects missing or too-short numbers", () => {
    expect(explorePhoneHref(null)).toBeNull();
    expect(explorePhoneHref("ext 12")).toBeNull();
  });
});
