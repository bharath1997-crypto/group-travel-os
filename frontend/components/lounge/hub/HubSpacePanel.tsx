"use client";

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Globe,
  Headphones,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import {
  addSpaceApp,
  isSpaceIframeBlocked,
  canPlayListenUrl,
  isActivatableListenUrl,
  listenUrlPlayHint,
  normalizeListenUrl,
  readSpaceApps,
  removeSpaceApp,
  resolveSpaceAudioEmbed,
  SPACE_APP_PRESETS,
  SPACE_PRESET_STYLE,
  spaceAppStyle,
  updateSpaceApp,
  type SpaceApp,
} from "@/lib/lounge/space-apps";

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|wav|flac|webm)(\?|$)/i;

type LocalTrack = {
  id: string;
  name: string;
  url: string;
};

function revokeTracks(tracks: LocalTrack[]) {
  tracks.forEach((t) => {
    try {
      URL.revokeObjectURL(t.url);
    } catch {
      /* ignore */
    }
  });
}

/** Small popup window for full web apps (YouTube Music login, etc.). */
function openSpaceWebApp(url: string) {
  const opened = window.open(
    url,
    "rovvy-space-web",
    "popup=yes,width=400,height=740,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes",
  );
  if (!opened) {
    window.location.assign(url);
  }
}

function hasValidListenEmbed(app: SpaceApp): boolean {
  const listen = app.listenUrl?.trim();
  if (!listen) return false;
  return canPlayListenUrl(listen);
}

/** Fills the Space tab — web connect + optional in-lounge audio. */
function SpaceAppPopup({
  app,
  onClose,
  onAppUpdated,
}: {
  app: SpaceApp;
  onClose: () => void;
  onAppUpdated: () => void;
}) {
  const [draftListen, setDraftListen] = useState(app.listenUrl ?? "");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const autoWebRef = useRef(false);
  const style = spaceAppStyle(app);
  const blocked = isSpaceIframeBlocked(app.url);
  const embed = hasValidListenEmbed(app) ? resolveSpaceAudioEmbed(app) : null;
  const showPlayer = Boolean(embed);

  const webTarget = () => normalizeListenUrl(draftListen) || app.url;

  const openWeb = (url: string) => {
    openSpaceWebApp(url);
    setLinkNotice("Web player opened — map stays on screen.");
    setLinkError(null);
  };

  /** Activate link: in-Lounge player when possible, else travel web popup. */
  const activateLink = () => {
    const url = normalizeListenUrl(draftListen);
    if (!url || !isActivatableListenUrl(url)) {
      setLinkError(listenUrlPlayHint(draftListen));
      return;
    }
    updateSpaceApp(app.id, { listenUrl: url });
    if (canPlayListenUrl(url)) {
      setLinkNotice(null);
      setLinkError(null);
      onAppUpdated();
      return;
    }
    openWeb(url);
    onAppUpdated();
  };

  useEffect(() => {
    setDraftListen(app.listenUrl ?? "");
  }, [app.listenUrl, app.id]);

  useEffect(() => {
    if (autoWebRef.current || showPlayer) return;
    const saved = app.listenUrl?.trim();
    if (!saved || canPlayListenUrl(saved)) return;
    const normalized = normalizeListenUrl(saved);
    if (!normalized) return;
    autoWebRef.current = true;
    openSpaceWebApp(normalized);
    setLinkNotice("Resumed your link in the web player.");
  }, [app.listenUrl, app.id, showPlayer]);

  useEffect(() => {
    if (showPlayer && embed) {
      setLinkNotice(null);
    }
  }, [showPlayer, embed]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-app">
      <div className="flex shrink-0 items-center gap-2 bg-slate-900 px-3 py-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
          style={{ background: style.bg }}
        >
          {style.label}
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
          {app.name}
        </p>
        {blocked ? (
          <button
            type="button"
            onClick={() => openWeb(webTarget())}
            className="flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-white/25"
          >
            <Globe size={12} />
            Web
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {showPlayer ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2">
            <p className="truncate text-[11px] font-medium text-stone-600">Playing in Lounge</p>
            <button
              type="button"
              onClick={() => {
                updateSpaceApp(app.id, { listenUrl: null });
                onAppUpdated();
              }}
              className="text-[10px] font-semibold text-primary"
            >
              Change link
            </button>
          </div>
          <div className="flex min-h-[180px] flex-1 flex-col justify-center bg-stone-900 p-3">
            {/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(embed!) ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio src={embed!} controls autoPlay className="w-full" />
            ) : (
              <iframe
                title={app.name}
                src={embed!}
                className="h-[200px] w-full rounded-lg border-0"
                allow="autoplay; encrypted-media"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col items-center text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-base font-bold text-white shadow-md"
              style={{ background: style.bg }}
            >
              {style.label}
            </span>
            <p className="mt-2 text-[13px] font-semibold text-slate-900">{app.name}</p>
          </div>

          {blocked ? (
            <button
              type="button"
              onClick={() => openWeb(webTarget())}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[13px] font-bold text-white shadow-md active:scale-[0.98]"
              style={{ background: style.bg }}
            >
              <Globe size={18} strokeWidth={2.25} />
              Connect on web
            </button>
          ) : null}

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-stone-400">
              paste a link
            </span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200/90">
            <input
              value={draftListen}
              onChange={(e) => {
                setDraftListen(e.target.value);
                setLinkError(null);
                setLinkNotice(null);
              }}
              placeholder="Song, playlist, or podcast link"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs outline-none focus:border-primary"
            />
            {linkNotice ? (
              <p className="mt-2 text-[10px] leading-snug text-primary">{linkNotice}</p>
            ) : null}
            {linkError ? (
              <p className="mt-2 text-[10px] leading-snug text-amber-700">{linkError}</p>
            ) : null}
            <button
              type="button"
              onClick={activateLink}
              disabled={!draftListen.trim()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              <Headphones size={14} />
              Start
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] leading-relaxed text-stone-400">
            Songs &amp; playlists play here. Podcasts &amp; full pages open in the
            small web window — map keeps running.
          </p>
        </div>
      )}
    </div>
  );
}

function RovvyLocalPlayer({
  tracks,
  index,
  onIndexChange,
  onClose,
}: {
  tracks: LocalTrack[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const track = tracks[index];

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track) return;
    el.src = track.url;
    void el.play().catch(() => undefined);
  }, [track]);

  const next = () => onIndexChange((index + 1) % tracks.length);
  const prev = () => onIndexChange((index - 1 + tracks.length) % tracks.length);

  if (!track) return null;

  return (
    <div className="shrink-0 border-t border-stone-200 bg-white px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[9px] font-bold text-white">
          R
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-800">
          {track.name}
        </p>
        <span className="text-[9px] text-stone-400">
          {index + 1}/{tracks.length}
        </span>
        <button type="button" onClick={prev} className="p-1 text-stone-500" aria-label="Previous">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={next} className="p-1 text-stone-500" aria-label="Next">
          <ChevronRight size={16} />
        </button>
        <button type="button" onClick={onClose} className="p-1 text-stone-400" aria-label="Stop">
          <X size={15} />
        </button>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} controls className="h-8 w-full" onEnded={next} />
    </div>
  );
}

export function HubSpacePanel() {
  const [apps, setApps] = useState<SpaceApp[]>([]);
  const [adding, setAdding] = useState(false);
  const [menuAppId, setMenuAppId] = useState<string | null>(null);
  const [popupApp, setPopupApp] = useState<SpaceApp | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [localIndex, setLocalIndex] = useState(0);
  const [localActive, setLocalActive] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApps(readSpaceApps());
  }, []);

  useEffect(
    () => () => revokeTracks(localTracks),
    [localTracks],
  );

  const refresh = useCallback(() => setApps(readSpaceApps()), []);

  const addPreset = (preset: (typeof SPACE_APP_PRESETS)[number]) => {
    if (apps.some((a) => a.presetKey === preset.presetKey)) return;
    addSpaceApp(preset);
    refresh();
  };

  const addCustom = () => {
    const name = draftName.trim();
    let url = draftUrl.trim();
    if (!name || !url) return;
    if (!url.startsWith("http")) url = `https://${url}`;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      return;
    }
    addSpaceApp({ name, url, kind: "custom" });
    setDraftName("");
    setDraftUrl("");
    setAdding(false);
    refresh();
  };

  const openApp = (app: SpaceApp) => {
    setMenuAppId(null);
    setPopupApp(app);
  };

  const onPickLocalFolder = (files: FileList | null) => {
    if (!files?.length) return;
    revokeTracks(localTracks);
    const tracks: LocalTrack[] = [];
    Array.from(files).forEach((file) => {
      if (!AUDIO_EXT.test(file.name)) return;
      tracks.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        url: URL.createObjectURL(file),
      });
    });
    tracks.sort((a, b) => a.name.localeCompare(b.name));
    if (tracks.length === 0) return;
    setLocalTracks(tracks);
    setLocalIndex(0);
    setLocalActive(true);
    setPopupApp(null);
  };

  const missingPresets = SPACE_APP_PRESETS.filter(
    (p) => !apps.some((a) => a.presetKey === p.presetKey),
  );

  if (popupApp) {
    return (
      <SpaceAppPopup
        app={apps.find((a) => a.id === popupApp.id) ?? popupApp}
        onClose={() => setPopupApp(null)}
        onAppUpdated={() => {
          refresh();
          const fresh = readSpaceApps().find((a) => a.id === popupApp.id);
          if (fresh) setPopupApp(fresh);
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-app">
      <input
        ref={folderInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          onPickLocalFolder(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Audio apps
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm ring-1 ring-stone-200/80"
            aria-label="Add app"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-3">
          <div className="relative flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-md transition active:scale-95 ${
                localActive ? "ring-2 ring-[#0F766E] ring-offset-2" : ""
              }`}
              title="Rovvy Music — your files"
            >
              <FolderOpen size={22} strokeWidth={2} />
            </button>
            <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-stone-600">
              My Music
            </span>
          </div>

          {missingPresets.map((preset) => {
            const presetStyle = preset.presetKey
              ? SPACE_PRESET_STYLE[preset.presetKey]
              : null;
            return (
              <button
                key={preset.presetKey}
                type="button"
                onClick={() => addPreset(preset)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm opacity-75"
                  style={{ background: presetStyle?.bg ?? "#64748b" }}
                >
                  {presetStyle?.label ?? "+"}
                </span>
                <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-stone-500">
                  + {presetStyle?.short ?? preset.name}
                </span>
              </button>
            );
          })}

          {apps.map((app) => {
            const appStyle = spaceAppStyle(app);
            return (
              <div key={app.id} className="relative flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openApp(app)}
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md transition active:scale-95"
                  style={{ background: appStyle.bg }}
                  title={app.name}
                >
                  {appStyle.label}
                </button>
                <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-stone-600">
                  {app.name.split(" ")[0]}
                </span>
                <button
                  type="button"
                  onClick={() => setMenuAppId((id) => (id === app.id ? null : app.id))}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-stone-500 shadow ring-1 ring-stone-200/90"
                  aria-label={`Options for ${app.name}`}
                >
                  <MoreHorizontal size={11} />
                </button>
                {menuAppId === app.id ? (
                  <div className="absolute left-1/2 top-[calc(100%-0.25rem)] z-20 min-w-[6rem] -translate-x-1/2 rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        removeSpaceApp(app.id);
                        setMenuAppId(null);
                        refresh();
                      }}
                      className="w-full px-3 py-1.5 text-left text-[11px] text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {apps.length === 0 && missingPresets.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-stone-500">
            Tap + to pin a music app.
          </p>
        ) : null}
      </div>

      {localActive && localTracks.length > 0 ? (
        <RovvyLocalPlayer
          tracks={localTracks}
          index={localIndex}
          onIndexChange={setLocalIndex}
          onClose={() => {
            revokeTracks(localTracks);
            setLocalTracks([]);
            setLocalActive(false);
          }}
        />
      ) : null}

      {adding ? (
        <div className="absolute inset-0 z-50 flex items-end bg-black/35 p-3">
          <div className="w-full rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Add app</p>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close">
                <X size={18} className="text-stone-400" />
              </button>
            </div>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Name"
              className="mb-2 w-full rounded-xl border-0 bg-stone-100 px-3 py-2.5 text-xs outline-none ring-1 ring-stone-200 focus:ring-[#0F766E]"
            />
            <input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://…"
              className="mb-3 w-full rounded-xl border-0 bg-stone-100 px-3 py-2.5 text-xs outline-none ring-1 ring-stone-200 focus:ring-[#0F766E]"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!draftName.trim() || !draftUrl.trim()}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
