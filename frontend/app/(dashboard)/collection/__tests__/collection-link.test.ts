import { describe, expect, it } from "vitest";

import { candidateToBody, draftFromCandidate, linkOnlyBody, sourceLink } from "../collection-link";

const cand = {
  name: "Time Out Market",
  city: "Lisbon",
  country: "Portugal",
  category: "Food",
  match_status: "sure",
  saved_from: "https://youtu.be/abc#place=time-out-market",
};

describe("collection-link", () => {
  it("a sure candidate with a city goes straight to the grid", () => {
    const body = candidateToBody(cand, draftFromCandidate(cand));
    expect(body.is_unsorted).toBe(false);
    expect(body.source).toBe("Link");
    expect(body.saved_from).toBe("https://youtu.be/abc#place=time-out-market");
  });

  it("unconfirmed or city-less candidates go to Unsorted", () => {
    expect(candidateToBody({ ...cand, match_status: "unsure" }, draftFromCandidate(cand)).is_unsorted).toBe(true);
    expect(candidateToBody(cand, { ...draftFromCandidate(cand), city: "  " }).is_unsorted).toBe(true);
    expect(candidateToBody({ ...cand, match_status: undefined }, draftFromCandidate(cand)).is_unsorted).toBe(true);
  });

  it("uses the user's edits, trimmed, and nulls empty fields", () => {
    const body = candidateToBody(cand, { name: " Mercado da Ribeira ", city: "Lisboa", category: "" });
    expect(body).toMatchObject({ name: "Mercado da Ribeira", city: "Lisboa", category: null });
  });

  it("two places from one link get different saved_from keys", () => {
    const a = candidateToBody({ ...cand, saved_from: "https://x.com/a#place=a" }, draftFromCandidate(cand));
    const b = candidateToBody({ ...cand, saved_from: "https://x.com/a#place=b" }, draftFromCandidate(cand));
    expect(a.saved_from).not.toBe(b.saved_from);
  });

  it("keeps a link-only entry in Unsorted with the exact link", () => {
    const body = linkOnlyBody("https://www.instagram.com/reel/abc/", "");
    expect(body).toMatchObject({ saved_from: "https://www.instagram.com/reel/abc/", is_unsorted: true, match_status: "unknown" });
    expect(body.name).toBe("Instagram reel abc");
  });

  it("only http(s) saved_from values become links, without the place fragment", () => {
    expect(sourceLink("https://www.example.com/top-10#place=a")).toEqual({ href: "https://www.example.com/top-10", label: "example.com…" });
    expect(sourceLink("javascript:alert(1)")).toBeNull();
    expect(sourceLink("explore:listing:place:x")).toBeNull();
    expect(sourceLink("Searched from the map")).toBeNull();
    expect(sourceLink(null)).toBeNull();
  });
});
