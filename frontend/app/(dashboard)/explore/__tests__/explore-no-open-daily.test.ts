import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EXPLORE_ROOT = join(process.cwd(), "app/(dashboard)/explore");

function listExploreSources(): string[] {
  const out: string[] = [];
  function visit(rel: string) {
    const full = join(EXPLORE_ROOT, rel);
    for (const name of readdirSync(full)) {
      const p = join(full, name);
      if (statSync(p).isDirectory()) {
        if (name === "__tests__") continue;
        visit(join(rel, name));
      } else if (/\.(tsx|ts)$/.test(name)) {
        out.push(p);
      }
    }
  }
  visit("");
  return out;
}

describe("explore availability copy guardrails", () => {
  it("does not hard-code Open daily in explore UI sources", () => {
    const offenders = listExploreSources().filter((path) => {
      if (path.includes("explore-availability-copy")) return false;
      return /Open daily|Open now/i.test(readFileSync(path, "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});
