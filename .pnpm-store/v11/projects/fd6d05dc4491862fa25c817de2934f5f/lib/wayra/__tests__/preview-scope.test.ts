import { describe, expect, it } from "vitest";

import { isPreviewScopedWayraMessage } from "@/lib/wayra/preview-scope";

describe("preview-scoped Wayra messages", () => {
  it("detects tap brief and pin messages", () => {
    expect(isPreviewScopedWayraMessage("Pin dropped. Ask me anything about this spot.")).toBe(
      true,
    );
    expect(
      isPreviewScopedWayraMessage(
        "You picked Grant Park on the Live map at 41.87, -87.62.",
      ),
    ).toBe(true);
    expect(isPreviewScopedWayraMessage("What can I do around here?")).toBe(false);
  });
});
