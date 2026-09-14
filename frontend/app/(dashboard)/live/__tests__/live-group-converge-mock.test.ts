import { describe, expect, it } from "vitest";
import {
  buildDefaultConvergeMembers,
  lastOneInMinutes,
} from "../live-group-converge-mock";

describe("live-group-converge-mock", () => {
  it("uses the slowest ETA for last-one-in", () => {
    const members = buildDefaultConvergeMembers(6);
    expect(lastOneInMinutes(members)).toBe(22);
  });
});
