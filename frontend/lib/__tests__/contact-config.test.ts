import { describe, expect, it } from "vitest";

import { CONTACT_EMAIL } from "../contact-config";

describe("contact-config", () => {
  it("exposes the public removal and legal contact address", () => {
    expect(CONTACT_EMAIL).toBe("rovvy230@gmail.com");
  });
});
