import { describe, expect, it } from "vitest";
import {
  LIVE_PLACE_REPORT_OPTIONS,
  livePlaceReportLabel,
} from "../live-place-report-types";

describe("livePlaceReportLabel", () => {
  it("returns human labels for all six report types", () => {
    expect(LIVE_PLACE_REPORT_OPTIONS).toHaveLength(6);
    for (const option of LIVE_PLACE_REPORT_OPTIONS) {
      expect(livePlaceReportLabel(option.id)).toBe(option.label);
    }
  });
});
