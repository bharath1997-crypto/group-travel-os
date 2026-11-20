// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeatsFindEmptyState } from "../SeatsFindEmptyState";

const base = {
  timeLabel: "6:00 AM",
  onWatch: vi.fn(),
  watchDisabled: false,
  watching: false,
  watchError: null as string | null,
};

describe("SeatsFindEmptyState", () => {
  it("shows sign in copy for auth variant", () => {
    render(<SeatsFindEmptyState {...base} variant="auth" onSignIn={vi.fn()} />);
    expect(screen.getByText(/SIGN IN/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /log in/i })).toBeTruthy();
    expect(screen.queryByText(/NO MATCHES/i)).toBeNull();
  });

  it("shows error state for error variant", () => {
    render(
      <SeatsFindEmptyState
        {...base}
        variant="error"
        errorMessage="Server unavailable"
      />,
    );
    expect(screen.getByText(/LISTINGS UNAVAILABLE/i)).toBeTruthy();
    expect(screen.getByText("Server unavailable")).toBeTruthy();
  });

  it("shows no matches for empty variant", () => {
    render(<SeatsFindEmptyState {...base} variant="empty" />);
    expect(screen.getByText(/NO MATCHES/i)).toBeTruthy();
  });
});
