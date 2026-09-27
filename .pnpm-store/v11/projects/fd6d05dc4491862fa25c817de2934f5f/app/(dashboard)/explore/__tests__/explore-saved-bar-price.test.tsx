import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ExploreSavedBar } from "../components/ExploreSavedBar";

describe("Explore saved bar while listings reload", () => {
  it("does not call an unresolved saved listing free", () => {
    const html = renderToStaticMarkup(
      <ExploreSavedBar savedIds={["gers-park"]} slotLookup={() => null} onClear={() => {}} />,
    );

    expect(html).toContain("Price unknown for some picks");
    expect(html).not.toContain("$0 each");
  });
});
