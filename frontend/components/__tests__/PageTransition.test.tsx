/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/trips" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { PageTransition } from "../PageTransition";

afterEach(() => cleanup());

describe("PageTransition", () => {
  it("wraps children in the page-enter element", () => {
    render(
      <PageTransition>
        <p data-testid="child">hello</p>
      </PageTransition>,
    );
    const wrapper = screen.getByTestId("child").parentElement as HTMLElement;
    expect(wrapper.className).toContain("rovvy-page-enter");
  });

  it("remounts the wrapper when the pathname changes so the animation replays", () => {
    const { rerender } = render(
      <PageTransition>
        <p data-testid="child">one</p>
      </PageTransition>,
    );
    const first = screen.getByTestId("child").parentElement;
    pathname.value = "/events";
    rerender(
      <PageTransition>
        <p data-testid="child">two</p>
      </PageTransition>,
    );
    expect(screen.getByTestId("child").parentElement).not.toBe(first);
  });

  it("keeps the same wrapper when the pathname is unchanged", () => {
    pathname.value = "/events";
    const { rerender } = render(
      <PageTransition>
        <p data-testid="child">one</p>
      </PageTransition>,
    );
    const first = screen.getByTestId("child").parentElement;
    rerender(
      <PageTransition>
        <p data-testid="child">two</p>
      </PageTransition>,
    );
    expect(screen.getByTestId("child").parentElement).toBe(first);
  });
});
