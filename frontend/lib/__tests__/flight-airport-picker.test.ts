import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptAllConsent,
  acceptNecessaryOnlyConsent,
  canUsePreferenceStorage,
  getConsentPreferences,
  readPreferenceValue,
  removePreferenceValue,
  writePreferenceValue,
} from "@/lib/consent-storage";
import {
  clearRecentFlightAirports,
  getRecentFlightAirports,
  recentAirportStorageMode,
  recordRecentFlightAirport,
} from "@/lib/flight-recent-airports";

const localMemory: Record<string, string> = {};
const sessionMemory: Record<string, string> = {};

function mockStorage(store: Record<string, string>): Storage {
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
    getItem(key: string) {
      return store[key] ?? null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  } as Storage;
}

describe("consent-aware preference storage", () => {
  beforeEach(() => {
    for (const key of Object.keys(localMemory)) delete localMemory[key];
    for (const key of Object.keys(sessionMemory)) delete sessionMemory[key];
    vi.stubGlobal("localStorage", mockStorage(localMemory));
    vi.stubGlobal("sessionStorage", mockStorage(sessionMemory));
    removePreferenceValue("rovvy.consent.preferences.v1");
    removePreferenceValue("rovvy.consent.banner.dismissed.v1");
    clearRecentFlightAirports();
  });

  it("uses localStorage for recent airports when preference consent is accepted", () => {
    acceptAllConsent();
    expect(canUsePreferenceStorage()).toBe(true);
    recordRecentFlightAirport({
      iata: "ORD",
      label: "Chicago O'Hare",
      city: "Chicago",
      region: "IL",
      country: "US",
    });
    expect(recentAirportStorageMode()).toBe("localStorage");
    expect(getRecentFlightAirports()[0]?.iata).toBe("ORD");
    expect(globalThis.localStorage.getItem("rovvy.flights.recentAirports.v1")).toBeTruthy();
  });

  it("uses sessionStorage when preference consent is declined", () => {
    acceptNecessaryOnlyConsent();
    expect(canUsePreferenceStorage()).toBe(false);
    recordRecentFlightAirport({
      iata: "JFK",
      label: "JFK",
      city: "New York",
      region: "NY",
      country: "US",
    });
    expect(recentAirportStorageMode()).toBe("sessionStorage");
    expect(getRecentFlightAirports()[0]?.iata).toBe("JFK");
    expect(globalThis.localStorage.getItem("rovvy.flights.recentAirports.v1")).toBeNull();
    expect(globalThis.sessionStorage.getItem("rovvy.flights.recentAirports.v1")).toBeTruthy();
  });

  it("deduplicates and reorders recent airports", () => {
    acceptAllConsent();
    recordRecentFlightAirport({
      iata: "ORD",
      label: "Chicago O'Hare",
      city: "Chicago",
      region: "IL",
      country: "US",
    });
    recordRecentFlightAirport({
      iata: "MDW",
      label: "Chicago Midway",
      city: "Chicago",
      region: "IL",
      country: "US",
    });
    recordRecentFlightAirport({
      iata: "ORD",
      label: "Chicago O'Hare",
      city: "Chicago",
      region: "IL",
      country: "US",
    });
    const recent = getRecentFlightAirports();
    expect(recent.map((row) => row.iata)).toEqual(["ORD", "MDW"]);
  });

  it("clears recent airports", () => {
    acceptAllConsent();
    recordRecentFlightAirport({
      iata: "ORD",
      label: "Chicago O'Hare",
      city: "Chicago",
      region: "IL",
      country: "US",
    });
    clearRecentFlightAirports();
    expect(getRecentFlightAirports()).toEqual([]);
  });
});

describe("consent preference helpers", () => {
  beforeEach(() => {
    for (const key of Object.keys(localMemory)) delete localMemory[key];
    for (const key of Object.keys(sessionMemory)) delete sessionMemory[key];
    vi.stubGlobal("localStorage", mockStorage(localMemory));
    vi.stubGlobal("sessionStorage", mockStorage(sessionMemory));
  });

  it("starts undecided until the user saves preferences", () => {
    const prefs = getConsentPreferences();
    expect(prefs.preferences).toBeNull();
    expect(prefs.analytics).toBeNull();
  });

  it("writes preference values through the selected backend", () => {
    acceptAllConsent();
    writePreferenceValue("demo.key", "value");
    expect(readPreferenceValue("demo.key")).toBe("value");
  });
});
