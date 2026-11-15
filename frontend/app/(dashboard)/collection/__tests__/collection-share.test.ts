import { describe, expect, it } from "vitest";

import { parseTags, restoreBody } from "../collection-edit";
import { formatSavedFrom } from "../collection-grouping";
import { candidateToBody, canonicalLink, extractSharedUrl, linkName, linkOnlyBody, linkSource } from "../collection-link";
import type { CollectionItem } from "../collection-types";

describe("extractSharedUrl (phone share sheet)", () => {
  it("prefers the url field", () => {
    expect(extractSharedUrl({ url: "https://youtu.be/abc", text: "ignored" })).toBe("https://youtu.be/abc");
  });

  it("finds the link inside shared text and drops trailing punctuation", () => {
    expect(extractSharedUrl({ text: "Look at this place! https://www.instagram.com/reel/XyZ/." })).toBe(
      "https://www.instagram.com/reel/XyZ/",
    );
  });

  it("falls back to title, and returns null when there is no web link", () => {
    expect(extractSharedUrl({ title: "see https://x.com/a/status/1" })).toBe("https://x.com/a/status/1");
    expect(extractSharedUrl({ text: "no link here", url: "ftp://x.test/a" })).toBeNull();
    expect(extractSharedUrl({})).toBeNull();
  });
});

describe("parseTags", () => {
  it("splits on commas and newlines, lower-cases, strips #, removes repeats", () => {
    expect(parseTags(" Date Night, #rainy   day\nDATE night ,, ")).toEqual(["date night", "rainy day"]);
  });

  it("caps at 10 tags of 40 characters", () => {
    expect(parseTags(Array.from({ length: 15 }, (_, i) => `t${i}`).join(","))).toHaveLength(10);
    expect(parseTags("x".repeat(60))[0]).toHaveLength(40);
  });

  it("empty input gives no tags", () => {
    expect(parseTags("  , ,")).toEqual([]);
  });
});

describe("tags travel with saves", () => {
  const cand = { name: "A", city: "Lisbon", match_status: "sure", saved_from: "https://a.test#place=a" };

  it("candidate and link-only bodies carry tags", () => {
    expect(candidateToBody(cand, { name: "A", city: "Lisbon", category: "" }, null, ["kids"]).tags).toEqual(["kids"]);
    expect(candidateToBody(cand, { name: "A", city: "Lisbon", category: "" }).tags).toEqual([]);
    expect(linkOnlyBody("https://a.test", "t", ["x"]).tags).toEqual(["x"]);
  });

  it("undo restores tags", () => {
    const item = { id: "1", name: "A", tags: ["kids"], source: "Link", stars: 0, match_status: "sure", is_unsorted: false } as unknown as CollectionItem;
    expect(restoreBody(item).tags).toEqual(["kids"]);
  });
});

describe("friend shares", () => {
  it("hides the internal share key and leaves the sender to the Shared by row", () => {
    expect(formatSavedFrom("share:abc:def")).toBeNull();
  });
});

describe("every link is kept: clean key, source and name", () => {
  it("strips share-tracking parameters so one reel saves once", () => {
    expect(canonicalLink("https://www.instagram.com/reel/AbC123/?igsh=MXx5&utm_source=ig_web")).toBe(
      "https://www.instagram.com/reel/AbC123/",
    );
    expect(canonicalLink("https://youtu.be/dQw4w9WgXcQ?si=abc123")).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(canonicalLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&t=42")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42",
    );
    expect(canonicalLink("https://x.com/a/status/1?s=20&t=zz#frag")).toBe("https://x.com/a/status/1");
  });

  it("keeps parameters that identify the page and tolerates non-links", () => {
    expect(canonicalLink("https://example.com/list?page=2&id=7")).toBe("https://example.com/list?page=2&id=7");
    expect(canonicalLink("not a link")).toBe("not a link");
  });

  it("reels and short videos are Reel, everything else Link", () => {
    expect(linkSource("https://www.instagram.com/reel/abc/")).toBe("Reel");
    expect(linkSource("https://www.tiktok.com/@a/video/123")).toBe("Reel");
    expect(linkSource("https://youtu.be/abc")).toBe("Link");
    expect(linkSource("nope")).toBe("Link");
  });

  it("gives a readable name without a title", () => {
    expect(linkName("https://www.instagram.com/reel/AbC123/", "instagram.com")).toBe("Instagram reel AbC123");
    expect(linkName("https://www.instagram.com/p/XyZ/")).toBe("Instagram post XyZ");
    expect(linkName("https://www.tiktok.com/@a/video/123")).toBe("TikTok video 123");
    expect(linkName("https://example.com/best/cafes", "")).toBe("example.com/best/cafes");
    expect(linkName("https://example.com/a", "Best cafes in Lisbon")).toBe("Best cafes in Lisbon");
  });

  it("the automatic save is an unsorted Reel/Link row keyed by the clean link", () => {
    expect(linkOnlyBody("https://www.instagram.com/reel/AbC123/", "")).toMatchObject({
      name: "Instagram reel AbC123",
      source: "Reel",
      saved_from: "https://www.instagram.com/reel/AbC123/",
      is_unsorted: true,
      tags: [],
    });
  });
});
