/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EXPLORE_PHOTO_UNAVAILABLE } from "../explore-listing-field-state";
import { ExploreCardImage } from "@/components/explorer/ExploreCardImage";

const BAD_URL = "https://cdn.example/broken.jpg";
const GOOD_URL = "https://cdn.example/valid.jpg";
const GOOD_URL_2 = "https://cdn.example/other-valid.jpg";

describe("ExploreCardImage inventory photo lifecycle", () => {
  it("clears loadFailed after error when placeId or imageUrl changes", () => {
    const { rerender } = render(
      <ExploreCardImage
        fallbackMode="unknown"
        imageUrl={BAD_URL}
        alt="Listing A"
        placeId="listing-a"
        category="Events"
      />,
    );

    const img = screen.getByRole("img", { name: "Listing A" });
    fireEvent.error(img);
    expect(screen.getByText(EXPLORE_PHOTO_UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Listing A" })).toBeNull();

    rerender(
      <ExploreCardImage
        fallbackMode="unknown"
        imageUrl={GOOD_URL}
        alt="Listing B"
        placeId="listing-b"
        category="Events"
      />,
    );

    expect(screen.queryByText(EXPLORE_PHOTO_UNAVAILABLE)).toBeNull();
    expect(screen.getByRole("img", { name: "Listing B" }).getAttribute("src")).toBe(GOOD_URL);

    fireEvent.error(screen.getByRole("img", { name: "Listing B" }));
    expect(screen.getByText(EXPLORE_PHOTO_UNAVAILABLE)).toBeTruthy();

    rerender(
      <ExploreCardImage
        fallbackMode="unknown"
        imageUrl={GOOD_URL_2}
        alt="Listing B"
        placeId="listing-b"
        category="Events"
      />,
    );

    expect(screen.queryByText(EXPLORE_PHOTO_UNAVAILABLE)).toBeNull();
    expect(screen.getByRole("img", { name: "Listing B" }).getAttribute("src")).toBe(GOOD_URL_2);
  });
});
