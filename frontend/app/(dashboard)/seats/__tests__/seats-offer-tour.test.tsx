// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeatsOfferTour } from "../SeatsOfferTour";
import {
  hasSeenOfferTour,
  markOfferTourSeen,
  OFFER_TOUR_KEY,
  OFFER_TOUR_STEPS,
} from "../seats-offer-tour";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("offer tour content", () => {
  it("has unique steps, each with a title, body and points", () => {
    const ids = OFFER_TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of OFFER_TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      expect(s.points.length).toBeGreaterThan(0);
    }
  });
  it("states the product rules and invents no prices", () => {
    const text = JSON.stringify(OFFER_TOUR_STEPS);
    expect(text).toContain("moves no money");
    expect(text).toContain("200 miles");
    expect(text).not.toMatch(/[$₹€£]\s?\d/);
  });
});

describe("seen flag", () => {
  it("is false until marked, then true", () => {
    expect(hasSeenOfferTour()).toBe(false);
    markOfferTourSeen();
    expect(window.localStorage.getItem(OFFER_TOUR_KEY)).toBe("seen");
    expect(hasSeenOfferTour()).toBe(true);
  });
  it("does not nag when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasSeenOfferTour()).toBe(true);
    spy.mockRestore();
  });
});

describe("SeatsOfferTour", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SeatsOfferTour open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("walks every step and finishes with a close", () => {
    const onClose = vi.fn();
    render(<SeatsOfferTour open onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(`Offer a ride · demo 1 of ${OFFER_TOUR_STEPS.length}`)).toBeTruthy();
    for (let i = 1; i < OFFER_TOUR_STEPS.length; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText(OFFER_TOUR_STEPS[OFFER_TOUR_STEPS.length - 1].title)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start offering a ride" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes back, skips and closes with Escape", () => {
    const onClose = vi.fn();
    render(<SeatsOfferTour open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(OFFER_TOUR_STEPS[0].title)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
