import { describe, expect, it } from "vitest";

import { buildShareUrl, parseSharedPlace, sharedPlaceKey, shareText } from "../collection-share-link";

const item = {
  name: "Pastéis de Belém",
  city: "Lisbon",
  country: "Portugal",
  category: "Food",
  saved_from: "https://www.instagram.com/reel/AbC123/#place=x",
};

describe("share a place out", () => {
  it("builds a Rovvy link with only name, city, country, category and the source link", () => {
    const url = new URL(buildShareUrl("https://rovvy.app/", item));
    expect(url.origin + url.pathname).toBe("https://rovvy.app/collection/add");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: "Pastéis de Belém",
      city: "Lisbon",
      country: "Portugal",
      category: "Food",
      from: "https://www.instagram.com/reel/AbC123/",
    });
  });

  it("never puts notes, stars or tags in the link, even if the item has them", () => {
    const url = buildShareUrl("https://rovvy.app", { ...item, note: "my secret", stars: 5, tags: ["private"] } as never);
    expect(url).not.toMatch(/secret|stars|private|note|tags/i);
  });

  it("leaves out empty fields and non-web sources", () => {
    const url = new URL(buildShareUrl("https://rovvy.app", { name: "Spot", city: null, country: null, category: null, saved_from: "explore:listing:1" }));
    expect([...url.searchParams.keys()]).toEqual(["name"]);
  });

  it("describes the share for WhatsApp and similar", () => {
    expect(shareText(item)).toBe("Pastéis de Belém in Lisbon, saved on Rovvy");
    expect(shareText({ name: "Spot", city: null })).toBe("Spot, saved on Rovvy");
  });
});

describe("open a shared place", () => {
  const read = (qs: string) => parseSharedPlace(new URLSearchParams(qs));

  it("reads the place and trims it", () => {
    expect(read("name=%20Cafe%20Uno%20&city=Lisbon")).toEqual({ name: "Cafe Uno", city: "Lisbon", country: "", category: "", from: "" });
  });

  it("needs a name", () => {
    expect(read("city=Lisbon")).toBeNull();
    expect(read("name=%20%20")).toBeNull();
  });

  it("drops a source that is not a web link and caps lengths", () => {
    expect(read("name=A&from=javascript:alert(1)")?.from).toBe("");
    expect(read(`name=${"x".repeat(500)}`)?.name).toHaveLength(200);
  });

  it("opening the same link twice gives the same key, different places differ", () => {
    const a = read("name=Caf%C3%A9%20Uno&city=Lisbon")!;
    expect(sharedPlaceKey(a)).toBe(sharedPlaceKey(read("name=Cafe%20Uno&city=lisbon")!));
    expect(sharedPlaceKey(a)).not.toBe(sharedPlaceKey(read("name=Cafe%20Dos&city=Lisbon")!));
    expect(sharedPlaceKey(a)).toMatch(/^https:\/\/rovvy\.app\/shared#shared=cafe-uno-lisbon$/);
    expect(sharedPlaceKey(read("name=A&from=https://x.test/p")!)).toBe("https://x.test/p#shared=a");
  });
});
