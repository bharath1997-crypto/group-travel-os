import { describe, expect, it } from "vitest";

import { formatSavedWhen, filterBySearch } from "../collection-grouping";
import { parseTags } from "../collection-edit";
import { canonicalLink, extractSharedUrl, hostIs, linkName, linkSource, MAX_LINK_LENGTH } from "../collection-link";
import { parseSharedPlace } from "../collection-share-link";
import type { CollectionItem } from "../collection-types";

/** Regression tests for the Collection bug audit (2026-11-15). IDs match the Bug Register sheet. */

describe("F01 tracking parameters are removed per platform, never from content", () => {
  it("keeps a forum thread id and a search term", () => {
    expect(canonicalLink("https://forum.example.com/viewtopic.php?t=123&ref=a")).toBe("https://forum.example.com/viewtopic.php?t=123&ref=a");
    expect(canonicalLink("https://shop.example.com/find?s=cafes")).toBe("https://shop.example.com/find?s=cafes");
  });
  it("still drops share tracking on the platforms that add it", () => {
    expect(canonicalLink("https://www.instagram.com/reel/AbC/?igsh=zzz")).toBe("https://www.instagram.com/reel/AbC/");
    expect(canonicalLink("https://youtu.be/abcdefghijk?si=xyz&t=30")).toBe("https://youtu.be/abcdefghijk?t=30");
    expect(canonicalLink("https://x.com/a/status/1?s=20&t=abc")).toBe("https://x.com/a/status/1");
    expect(canonicalLink("https://example.com/a?utm_source=x&id=7")).toBe("https://example.com/a?id=7");
  });
});

describe("F02/F03 look-alike hosts", () => {
  it("matches the domain or a subdomain only", () => {
    expect(hostIs("www.instagram.com", "instagram.com")).toBe(true);
    expect(hostIs("instagram.com", "instagram.com")).toBe(true);
    expect(hostIs("notinstagram.com", "instagram.com")).toBe(false);
    expect(linkSource("https://notinstagram.com/x")).toBe("Link");
    expect(linkSource("https://www.instagram.com/reel/a")).toBe("Reel");
    expect(linkName("https://nottiktok.com/video/1", "")).toBe("nottiktok.com/video/1");
  });
  it("does not strip YouTube-style params on a look-alike", () => {
    expect(canonicalLink("https://notyoutube.com/watch?si=1&feature=x")).toBe("https://notyoutube.com/watch?si=1&feature=x");
  });
});

describe("F04 a link ending in a bracket", () => {
  it("keeps the closing bracket of a Wikipedia-style link", () => {
    expect(extractSharedUrl({ text: "see https://en.wikipedia.org/wiki/Foo_(bar)" })).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });
  it("drops brackets and punctuation that belong to the sentence", () => {
    expect(extractSharedUrl({ text: "(https://example.com/a)." })).toBe("https://example.com/a");
    expect(extractSharedUrl({ text: "Look: https://example.com/a, nice!" })).toBe("https://example.com/a");
  });
});

describe("F05 long links", () => {
  it("states the limit the page enforces", () => {
    expect(MAX_LINK_LENGTH).toBe(500);
  });
});

describe("B16 tags keep a # inside a word", () => {
  it("c# stays c#, a leading # is decoration", () => {
    expect(parseTags("c#, #rainy day, f #sharp")).toEqual(["c#", "rainy day", "f sharp"]);
  });
});

describe("F15 a broken source link in a shared place", () => {
  it("is dropped instead of crashing the page", () => {
    expect(parseSharedPlace(new URLSearchParams("name=A&from=https://["))?.from).toBe("");
    expect(parseSharedPlace(new URLSearchParams("name=A&from=https://"))?.from).toBe("");
    expect(parseSharedPlace(new URLSearchParams("name=A&from=https://ok.test/x"))?.from).toBe("https://ok.test/x");
  });
});

describe("F29 saved dates use calendar days", () => {
  it("11 pm yesterday is yesterday at 1 am", () => {
    const now = new Date(2026, 10, 15, 1, 0).getTime();
    const saved = new Date(2026, 10, 14, 23, 0).toISOString();
    expect(formatSavedWhen(saved, now)).toBe("yesterday");
  });
  it("earlier today is today", () => {
    const now = new Date(2026, 10, 15, 18, 0).getTime();
    expect(formatSavedWhen(new Date(2026, 10, 15, 0, 5).toISOString(), now)).toBe("today");
  });
});

describe("F28 search does not match internal keys", () => {
  const item = { name: "Cafe Uno", city: "Lisbon", saved_from: "share:abc:def", source: "Friend" } as CollectionItem;
  it("finds by name and city but not by the hidden key", () => {
    expect(filterBySearch([item], "uno")).toHaveLength(1);
    expect(filterBySearch([item], "share")).toHaveLength(0);
  });
});
