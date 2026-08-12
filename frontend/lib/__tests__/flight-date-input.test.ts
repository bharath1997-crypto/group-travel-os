import { describe, expect, it } from "vitest";
import {
  formatUsDateTyping,
  isoToUsDisplay,
  parseUsDateInput,
  previewIsoFromParsed,
} from "@/lib/flight-date-input";

describe("flight-date-input", () => {
  it("formats typing digits into MM/DD/YYYY", () => {
    expect(formatUsDateTyping("12")).toBe("12");
    expect(formatUsDateTyping("1218")).toBe("12/18");
    expect(formatUsDateTyping("12182026")).toBe("12/18/2026");
  });

  it("converts iso to US display", () => {
    expect(isoToUsDisplay("2026-08-26")).toBe("08/26/2026");
  });

  it("parses partial month for calendar navigation", () => {
    const dec = parseUsDateInput("12");
    expect(dec.month).toBe(12);
    expect(dec.isComplete).toBe(false);

    const day = parseUsDateInput("12/18");
    expect(day.month).toBe(12);
    expect(day.day).toBe(18);
    expect(previewIsoFromParsed(day, 2026)).toBe("2026-12-18");
  });

  it("parses a complete US date", () => {
    const full = parseUsDateInput("08/26/2026");
    expect(full.isComplete).toBe(true);
    expect(full.iso).toBe("2026-08-26");
  });
});
