import { describe, expect, it } from "vitest";
import { majorTextToMinor, minorToMajorText } from "../seats-price-input";
import { parseOfferDraft } from "../seats-offer-draft";
import {
  isFutureDeparture,
  resolveOfferTimeZone,
  todayInZone,
  zonedDateTimeToUtc,
} from "../seats-time";

describe("zonedDateTimeToUtc", () => {
  it("converts India wall time to UTC", () => {
    expect(zonedDateTimeToUtc("2026-12-01", "05:30", "Asia/Kolkata")?.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });
  it("converts Chicago winter and summer time", () => {
    expect(zonedDateTimeToUtc("2026-12-01", "08:00", "America/Chicago")?.toISOString()).toBe(
      "2026-12-01T14:00:00.000Z",
    );
    expect(zonedDateTimeToUtc("2026-07-01", "08:00", "America/Chicago")?.toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
  });
  it("rejects bad input", () => {
    expect(zonedDateTimeToUtc("", "08:00", "UTC")).toBeNull();
    expect(zonedDateTimeToUtc("2026-12-01", "8am", "UTC")).toBeNull();
  });
});

describe("isFutureDeparture / todayInZone", () => {
  const now = new Date("2026-12-01T12:00:00Z");
  it("blocks the past and departures under 15 minutes away", () => {
    expect(isFutureDeparture("2026-11-30", "10:00", "UTC", now)).toBe(false);
    expect(isFutureDeparture("2026-12-01", "12:10", "UTC", now)).toBe(false);
    expect(isFutureDeparture("2026-12-01", "12:20", "UTC", now)).toBe(true);
  });
  it("reads today in the given zone", () => {
    expect(todayInZone("Asia/Kolkata", new Date("2026-12-01T20:00:00Z"))).toBe("2026-12-02");
  });
});

describe("resolveOfferTimeZone", () => {
  it("uses IST for Indian pickups", () => {
    expect(resolveOfferTimeZone({ lat: 19.1, lng: 72.8, address: "Mumbai" })).toBe("Asia/Kolkata");
  });
  it("uses the device zone for US pickups", () => {
    const tz = resolveOfferTimeZone({ lat: 41.9, lng: -87.7, address: "Chicago, USA" });
    expect(tz).not.toBe("Asia/Kolkata");
  });
});

describe("price input", () => {
  it("round-trips major and minor units", () => {
    expect(minorToMajorText(47000)).toBe("470");
    expect(minorToMajorText(1250)).toBe("12.50");
    expect(majorTextToMinor("12.50")).toBe(1250);
    expect(majorTextToMinor("1,200")).toBe(120000);
  });
  it("rejects junk", () => {
    expect(majorTextToMinor("")).toBeNull();
    expect(majorTextToMinor("abc")).toBeNull();
    expect(majorTextToMinor("-5")).toBeNull();
    expect(majorTextToMinor("1.234")).toBeNull();
  });
});

describe("parseOfferDraft", () => {
  const point = { address: "A", lat: 1, lng: 2, isConfirmed: true, source: "autocomplete" };
  const good = {
    from: point,
    to: point,
    vehicleType: "sedan",
    departDate: "2026-12-01",
    departTime: "08:00",
    seatsOffered: 2,
    approval: "manual",
    note: "hi",
  };
  it("accepts a valid draft", () => {
    expect(parseOfferDraft(JSON.stringify(good))?.seatsOffered).toBe(2);
  });
  it("rejects missing, corrupt or out-of-range drafts", () => {
    expect(parseOfferDraft(null)).toBeNull();
    expect(parseOfferDraft("{nope")).toBeNull();
    expect(parseOfferDraft(JSON.stringify({ ...good, seatsOffered: 9 }))).toBeNull();
    expect(parseOfferDraft(JSON.stringify({ ...good, approval: "x" }))).toBeNull();
  });
});
