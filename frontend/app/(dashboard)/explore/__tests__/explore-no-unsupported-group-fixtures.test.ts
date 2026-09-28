import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EXPLORE_FEED } from "../explore-fixtures";

const HUB_PRODUCTION_FILES = [
  "page.tsx",
  "explore-fixtures.ts",
  "components/ExploreDetailDrawer.tsx",
  "components/ExploreSavedBar.tsx",
  "components/ExploreSlotCard.tsx",
];

describe("Explore unsupported group fixtures", () => {
  it("keeps invitation cards out of the production masonry feed", () => {
    expect(EXPLORE_FEED.map((item) => item.kind)).not.toContain("invite");
  });

  it("does not expose fake attendance, invite, or split controls on the hub", () => {
    const root = join(process.cwd(), "app/(dashboard)/explore");
    const source = HUB_PRODUCTION_FILES.map((file) =>
      readFileSync(join(root, file), "utf8"),
    ).join("\n");

    for (const unsupported of [
      "friendsGoing",
      "friends going",
      "Where are my friends",
      "Invite friends",
      "ExploreInviteSheet",
      "Split (soon)",
      'kind: "invite"',
      "deposit splits in app",
    ]) {
      expect(source.toLowerCase()).not.toContain(unsupported.toLowerCase());
    }
  });
});
