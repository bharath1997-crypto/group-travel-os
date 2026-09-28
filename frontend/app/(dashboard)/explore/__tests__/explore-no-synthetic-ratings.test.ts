import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { stableEventFeed } from "../explore-category-feed";
import type { ExploreEvent } from "@/lib/explore-events";

const EXPLORE_ROOT = join(process.cwd(), "app/(dashboard)/explore");

function listExploreSources(): string[] {
  const out: string[] = [];
  function visit(rel: string) {
    const full = join(EXPLORE_ROOT, rel);
    for (const name of readdirSync(full)) {
      const p = join(full, name);
      const relPath = join(rel, name);
      if (statSync(p).isDirectory()) {
        if (name === "__tests__") continue;
        visit(relPath);
      } else if (/\.(tsx|ts)$/.test(name)) {
        out.push(p);
      }
    }
  }
  visit("");
  return out;
}

describe("explore tree — no synthetic ratings", () => {
  it("does not import pseudoRating under app/(dashboard)/explore", () => {
    const offenders = listExploreSources().filter((path) =>
      /\bpseudoRating\b/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("does not render star-score patterns in explore UI components", () => {
    const uiFiles = listExploreSources().filter(
      (p) => p.includes(`${join("components", "")}`) || p.endsWith("page.tsx"),
    );
    const starOffenders = uiFiles.filter((path) => {
      const text = readFileSync(path, "utf8");
      return /fill-amber-400|fill-yellow-400|pseudoRating/.test(text);
    });
    expect(starOffenders).toEqual([]);
  });

  it("category feed keeps provider order without rating sort", () => {
    const a = { id: "a", name: "A" } as ExploreEvent;
    const b = { id: "b", name: "B" } as ExploreEvent;
    expect(stableEventFeed([a, b]).map((e) => e.id)).toEqual(["a", "b"]);
  });
});
