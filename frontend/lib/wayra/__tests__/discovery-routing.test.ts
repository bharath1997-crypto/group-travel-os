import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  classifyDiscoveryExpects,
  isDiscoveryIdentityQuestion,
} from "@/lib/wayra/discovery";
import {
  classifyMode,
  detectBirdState,
  isLiveMapIdentityQuestion,
  isLivePlaceDeepQuestion,
  resolveAppGuideReply,
  resolveLiveMapContextReply,
} from "@/lib/wayra/intent";

const JSONL = join(
  process.cwd(),
  "..",
  "wyra",
  "wayra_discovery_questions.jsonl",
);

type DiscoveryRow = {
  id: string;
  question: string;
  category: string;
  expects: "local" | "llm" | "app_guide";
  needs_pin: boolean;
};

function loadQuestions(): DiscoveryRow[] {
  return readFileSync(JSONL, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DiscoveryRow);
}

const livePinContext = {
  pathname: "/live",
  selectedPlace: {
    name: "Eddy County, New Mexico",
    lat: 32.6062,
    lng: -104.24477,
    city: "Carlsbad",
    state: "New Mexico",
    country: "United States",
  },
};

describe("discovery routing", () => {
  it("routes identity questions locally", () => {
    expect(classifyDiscoveryExpects("ok so Where exactly is this plce?")).toBe("local");
    expect(isDiscoveryIdentityQuestion("What's the name of around here?")).toBe(true);
    expect(isLiveMapIdentityQuestion("What county/state is this region in?")).toBe(true);

    const reply = resolveLiveMapContextReply(
      "Where exactly is this spot?",
      "live",
      livePinContext,
    );
    expect(reply).toContain("Eddy County");
    expect(reply).toContain("32.60620");
  });

  it("routes whats_special and activities to LLM", () => {
    expect(classifyDiscoveryExpects("What is the special out there?")).toBe("llm");
    expect(classifyDiscoveryExpects("Anything fun around here?")).toBe("llm");
    expect(isLivePlaceDeepQuestion("Best attractions where I dropped the pin?")).toBe(true);
    expect(classifyMode("Best attractions where I dropped the pin?")).toBe("travel");
  });

  it("routes Live UI chip prompts with place names to travel/LLM", () => {
    expect(classifyDiscoveryExpects("What's at Kitikmeot Region?")).toBe("llm");
    expect(classifyDiscoveryExpects("What's at Paris?")).toBe("llm");
    expect(classifyDiscoveryExpects("How far is this from me?")).toBe("llm");
    expect(classifyDiscoveryExpects("Is this family friendly?")).toBe("llm");
    expect(classifyDiscoveryExpects("Is Chicago family friendly?")).toBe("llm");
    expect(classifyMode("What's at Kitikmeot Region?")).toBe("travel");
    expect(classifyMode("How far is this from me?")).toBe("travel");
    expect(classifyMode("Is this family friendly?")).toBe("travel");
    expect(detectBirdState("Is this family friendly?")).toBe("flying");
    expect(isLivePlaceDeepQuestion("What's at Kitikmeot Region?")).toBe(true);
  });

  it("routes app guide discovery locally", () => {
    expect(classifyDiscoveryExpects("one more thing, i'd like to know how does Live work?")).toBe(
      "app_guide",
    );
    expect(classifyMode("how does Live work?")).toBe("app_guide");
    expect(resolveAppGuideReply("how does Live work?")).toContain("Live");
  });

  it("keeps identity separate from special-out-there", () => {
    expect(classifyDiscoveryExpects("ok so What is out there?")).toBe("local");
    expect(classifyDiscoveryExpects("What is the special out there?")).toBe("llm");
  });

  it("matches JSONL expects for all discovery questions", () => {
    const rows = loadQuestions();
    let ok = 0;

    for (const row of rows) {
      const discovery = classifyDiscoveryExpects(row.question);
      let pass = false;

      if (row.expects === "local") {
        pass = isLiveMapIdentityQuestion(row.question);
      } else if (row.expects === "llm") {
        pass =
          isLivePlaceDeepQuestion(row.question) && classifyMode(row.question) === "travel";
      } else if (row.expects === "app_guide") {
        pass = classifyMode(row.question) === "app_guide";
      }

      if (pass) ok += 1;
      else if (ok < 5) {
        // only surface first failures inline; full count in assertion
      }
    }

    expect(ok).toBe(rows.length);
  });
});
