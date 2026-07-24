import { readJsonLs, writeJsonLs } from "@/lib/lounge/storage";

export const GT_SPACE_APPS = "gt_space_apps";

export type SpaceAppKind = "preset" | "custom";

export type SpaceApp = {
  id: string;
  name: string;
  url: string;
  kind: SpaceAppKind;
  /** Optional embed URL for in-Space audio playback */
  embedUrl?: string | null;
  presetKey?: string;
  /** User-pasted song/playlist for audio-only embed (YouTube, Spotify, etc.) */
  listenUrl?: string | null;
};

export const SPACE_APP_PRESETS: Omit<SpaceApp, "id">[] = [
  {
    name: "YouTube Music",
    url: "https://music.youtube.com",
    kind: "preset",
    presetKey: "youtube-music",
    embedUrl: null,
  },
  {
    name: "Spotify",
    url: "https://open.spotify.com",
    kind: "preset",
    presetKey: "spotify",
    embedUrl: "https://open.spotify.com/embed",
  },
  {
    name: "SoundCloud",
    url: "https://soundcloud.com/discover",
    kind: "preset",
    presetKey: "soundcloud",
    embedUrl: null,
  },
];

export const SPACE_PRESET_STYLE: Record<
  string,
  { bg: string; label: string; short: string }
> = {
  "youtube-music": { bg: "#FF0033", label: "YT", short: "Music" },
  spotify: { bg: "#1DB954", label: "♫", short: "Spotify" },
  soundcloud: { bg: "#FF5500", label: "SC", short: "Cloud" },
};

export function spaceAppStyle(app: SpaceApp): { bg: string; label: string } {
  if (app.presetKey && SPACE_PRESET_STYLE[app.presetKey]) {
    const s = SPACE_PRESET_STYLE[app.presetKey];
    return { bg: s.bg, label: s.label };
  }
  return { bg: "#0F766E", label: app.name.charAt(0).toUpperCase() };
}

export function readSpaceApps(): SpaceApp[] {
  return readJsonLs<SpaceApp[]>(GT_SPACE_APPS, []);
}

export function writeSpaceApps(apps: SpaceApp[]): void {
  writeJsonLs(GT_SPACE_APPS, apps);
}

export function addSpaceApp(app: Omit<SpaceApp, "id">): SpaceApp[] {
  const entry: SpaceApp = { ...app, id: `space_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  const next = [...readSpaceApps(), entry];
  writeSpaceApps(next);
  return next;
}

export function removeSpaceApp(id: string): SpaceApp[] {
  const next = readSpaceApps().filter((a) => a.id !== id);
  writeSpaceApps(next);
  return next;
}

export function updateSpaceApp(id: string, patch: Partial<Omit<SpaceApp, "id">>): SpaceApp[] {
  const next = readSpaceApps().map((a) => (a.id === id ? { ...a, ...patch } : a));
  writeSpaceApps(next);
  return next;
}

/** Hosts that refuse to load inside an iframe (blank white panel). */
export function isSpaceIframeBlocked(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "open.spotify.com" && u.pathname.startsWith("/embed")) return false;
    if (host.includes("youtube.com") && u.pathname.startsWith("/embed")) return false;
    if (host === "w.soundcloud.com") return false;

    const blockedHosts = [
      "music.youtube.com",
      "youtube.com",
      "m.youtube.com",
      "open.spotify.com",
      "soundcloud.com",
      "accounts.google.com",
    ];
    return blockedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return true;
  }
}

/** YouTube / YouTube Music video, playlist, or song link → embeddable player. */
export function youtubeEmbedFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const isYt =
      u.hostname.includes("youtube") ||
      u.hostname.includes("youtu.be") ||
      u.hostname.includes("music.youtube");

    if (!isYt) return null;

    const list = u.searchParams.get("list");
    if (list) {
      return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1&controls=1&modestbranding=1&rel=0`;
    }

    let id: string | null = u.searchParams.get("v");
    if (!id && u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1).split("/")[0] || null;
    }
    if (!id && u.pathname.startsWith("/embed/")) {
      id = u.pathname.split("/")[2] ?? null;
    }
    if (id) {
      return `https://www.youtube.com/embed/${id}?autoplay=1&controls=1&modestbranding=1&rel=0`;
    }

    return null;
  } catch {
    return null;
  }
}

/** Normalize pasted link for web popup or storage. */
export function normalizeListenUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  } catch {
    return null;
  }
}

/** Link can play in Lounge embed OR open in the travel web popup. */
export function isActivatableListenUrl(url: string): boolean {
  const normalized = normalizeListenUrl(url);
  if (!normalized) return false;
  return canPlayListenUrl(normalized) || /^https?:\/\//i.test(normalized);
}

/** Whether a pasted link can play inside Lounge (not just open on web). */
export function canPlayListenUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return Boolean(
    youtubeEmbedFromUrl(trimmed) ||
      spotifyEmbedFromUrl(trimmed) ||
      /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(trimmed),
  );
}

/** User-facing reason when Play here fails. */
export function listenUrlPlayHint(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("music.youtube.com") && u.pathname.includes("/podcast")) {
      return "Opens in the web player — your map keeps running.";
    }
    if (u.hostname.includes("music.youtube.com") && !u.searchParams.get("v") && !u.searchParams.get("list")) {
      return "Paste a song or playlist link, or tap Start to open this page in the web player.";
    }
  } catch {
    return "Paste a valid link.";
  }
  return "Paste a YouTube, Spotify, or music link.";
}

/** Spotify share link → embed player. */
export function spotifyEmbedFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    if (u.pathname.startsWith("/embed/")) return url;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `https://open.spotify.com/embed/${parts.slice(0, 2).join("/")}?utm_source=generator`;
    }
    return null;
  } catch {
    return null;
  }
}

/** YouTube watch/share URL → embed for audio-first mini player. */
export function youtubeEmbedForAudio(url: string): string | null {
  return youtubeEmbedFromUrl(url);
}

/** Resolve an in-Space audio embed URL (video sites play audio-only bar). */
export function resolveSpaceAudioEmbed(app: SpaceApp): string | null {
  const listen = app.listenUrl?.trim();
  if (listen) {
    const yt = youtubeEmbedFromUrl(listen);
    if (yt) return yt;
    const sp = spotifyEmbedFromUrl(listen);
    if (sp) return sp;
    if (/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(listen)) return listen;
  }
  if (app.embedUrl?.trim()) {
    return app.embedUrl.trim();
  }
  const yt = youtubeEmbedFromUrl(app.url);
  if (yt) return yt;
  const sp = spotifyEmbedFromUrl(app.url);
  if (sp) return sp;
  if (/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(app.url)) {
    return app.url;
  }
  return null;
}

export function isDirectAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url);
}
