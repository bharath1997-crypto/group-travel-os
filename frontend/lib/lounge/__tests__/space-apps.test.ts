import { describe, expect, it } from "vitest";

import {
  isSpaceIframeBlocked,
  resolveSpaceAudioEmbed,
  youtubeEmbedFromUrl,
  spotifyEmbedFromUrl,
  canPlayListenUrl,
  isActivatableListenUrl,
  listenUrlPlayHint,
  normalizeListenUrl,
} from "@/lib/lounge/space-apps";

describe("space-apps", () => {
  it("builds YouTube audio embed from watch URL", () => {
    expect(youtubeEmbedFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain(
      "embed/dQw4w9WgXcQ",
    );
  });

  it("builds embed from music.youtube.com watch URL", () => {
    expect(
      youtubeEmbedFromUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toContain("embed/dQw4w9WgXcQ");
  });

  it("builds embed from music.youtube.com playlist URL", () => {
    expect(
      youtubeEmbedFromUrl("https://music.youtube.com/playlist?list=PLtest123"),
    ).toContain("videoseries?list=PLtest123");
  });

  it("rejects music.youtube.com podcast URLs for in-lounge play", () => {
    const podcast = "https://music.youtube.com/podcast/V7Lwabc123";
    expect(canPlayListenUrl(podcast)).toBe(false);
    expect(isActivatableListenUrl(podcast)).toBe(true);
    expect(listenUrlPlayHint(podcast)).toMatch(/web player/i);
  });

  it("normalizes links without https prefix", () => {
    expect(normalizeListenUrl("music.youtube.com/podcast/x")).toBe(
      "https://music.youtube.com/podcast/x",
    );
  });

  it("builds YouTube playlist embed", () => {
    expect(
      youtubeEmbedFromUrl("https://www.youtube.com/watch?v=abc&list=PLtest123"),
    ).toContain("videoseries?list=PLtest123");
  });

  it("blocks music.youtube.com iframe", () => {
    expect(isSpaceIframeBlocked("https://music.youtube.com")).toBe(true);
  });

  it("resolves direct audio URLs", () => {
    const embed = resolveSpaceAudioEmbed({
      id: "a1",
      name: "Podcast",
      url: "https://cdn.example.com/ep.mp3",
      kind: "custom",
    });
    expect(embed).toBe("https://cdn.example.com/ep.mp3");
  });

  it("uses saved listenUrl for embed", () => {
    const embed = resolveSpaceAudioEmbed({
      id: "a2",
      name: "YT",
      url: "https://music.youtube.com",
      kind: "preset",
      listenUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(embed).toContain("embed/dQw4w9WgXcQ");
  });

  it("builds Spotify embed from share link", () => {
    expect(
      spotifyEmbedFromUrl("https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWNTQ5"),
    ).toContain("/embed/playlist/");
  });
});
