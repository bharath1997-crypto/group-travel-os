import { describe, expect, it } from "vitest";

import { isIgnorableSpeechError, textForSpeech } from "@/lib/wayra/wayra-speech";

describe("textForSpeech", () => {
  it("strips markdown links and extra whitespace", () => {
    expect(textForSpeech("Try [Rovvy Live](/live)  now")).toBe("Try Rovvy Live now");
  });

  it("removes raw URLs", () => {
    expect(textForSpeech("See https://example.com for details.")).toBe("See for details.");
  });
});

describe("isIgnorableSpeechError", () => {
  it("ignores silence and stop()", () => {
    expect(isIgnorableSpeechError("no-speech")).toBe(true);
    expect(isIgnorableSpeechError("aborted")).toBe(true);
    expect(isIgnorableSpeechError("not-allowed")).toBe(false);
  });
});
