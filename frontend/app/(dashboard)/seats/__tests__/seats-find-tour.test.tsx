// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeatsOfferTour } from "../SeatsOfferTour";
import {
  FIND_TOUR_KEY,
  FIND_TOUR_STEPS,
  hasSeenFindTour,
  markFindTourSeen,
} from "../seats-find-tour";
import { OFFER_TOUR_KEY } from "../seats-offer-tour";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("find tour content", () => {
  it("has unique steps, each with a title, body and points", () => {
    const ids = FIND_TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of FIND_TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      expect(s.points.length).toBeGreaterThan(0);
    }
  });
  it("states the product rules and invents no prices or ratings", () => {
    const text = JSON.stringify(FIND_TOUR_STEPS);
    expect(text).toContain("moves no money");
    expect(text).toContain("200 miles");
    expect(text).not.toMatch(/[$₹€£]\s?\d/);
    expect(text).not.toMatch(/rated|rating|stars/i);
  });
});

describe("find tour seen flag", () => {
  it("is separate from the Offer a ride flag", () => {
    expect(FIND_TOUR_KEY).not.toBe(OFFER_TOUR_KEY);
    expect(hasSeenFindTour()).toBe(false);
    markFindTourSeen();
    expect(hasSeenFindTour()).toBe(true);
    expect(window.localStorage.getItem(OFFER_TOUR_KEY)).toBeNull();
  });
  it("does not nag when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasSeenFindTour()).toBe(true);
    spy.mockRestore();
  });
});

describe("SeatsOfferTour with the Find steps", () => {
  it("shows the Find label and finish button, and walks every step", () => {
    const onClose = vi.fn();
    render(
      <SeatsOfferTour
        open
        onClose={onClose}
        steps={FIND_TOUR_STEPS}
        label="Find a seat"
        finishLabel="Start searching"
      />,
    );
    expect(screen.getByText(`Find a seat · demo 1 of ${FIND_TOUR_STEPS.length}`)).toBeTruthy();
    expect(screen.getByText(FIND_TOUR_STEPS[0].title)).toBeTruthy();
    for (let i = 1; i < FIND_TOUR_STEPS.length; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText(FIND_TOUR_STEPS[FIND_TOUR_STEPS.length - 1].title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start searching" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
