"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  FileText,
  ImagePlus,
  Mic,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import {
  addLiveSavedPlaceAttachment,
  getLiveSavedPlace,
  getLiveSavedPlaceAttachmentBlob,
  removeLiveSavedPlace,
  removeLiveSavedPlaceAttachment,
  updateLiveSavedPlaceNotes,
  type LiveSavedPlace,
  type LiveSavedPlaceAttachmentMeta,
} from "./live-saved-places-store";
import { LIVE_GLASS_SHEET, LIVE_GLASS_SIDE_PANEL } from "./live-design-tokens";

type Props = {
  placeId: string;
  onClose: () => void;
  isPhoneLayout?: boolean;
  wayraChatOpen?: boolean;
};

function formatSavedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AttachmentRow({
  placeId,
  attachment,
  onRemoved,
}: {
  placeId: string;
  attachment: LiveSavedPlaceAttachmentMeta;
  onRemoved: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.kind !== "photo") return;
    let revoked = false;
    void getLiveSavedPlaceAttachmentBlob(placeId, attachment.id).then((blob) => {
      if (!blob || revoked) return;
      setPreviewUrl(URL.createObjectURL(blob));
    });
    return () => {
      revoked = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, attachment.id, attachment.kind]);

  const handleOpen = async () => {
    const blob = await getLiveSavedPlaceAttachmentBlob(placeId, attachment.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-stone-100 bg-white/80 px-2 py-1.5">
      {attachment.kind === "photo" && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-stone-100 text-stone-500">
          {attachment.kind === "audio" ? (
            <Mic className="h-3.5 w-3.5" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleOpen()}
        className="min-w-0 flex-1 truncate text-left text-xs text-stone-700 hover:text-primary"
      >
        {attachment.name}
      </button>
      <button
        type="button"
        onClick={() => {
          void removeLiveSavedPlaceAttachment(placeId, attachment.id).then(onRemoved);
        }}
        className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-red-600"
        aria-label="Remove attachment"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function SavedPlacePanel({
  placeId,
  onClose,
  isPhoneLayout = false,
  wayraChatOpen = false,
}: Props) {
  const [place, setPlace] = useState<LiveSavedPlace | null>(() => getLiveSavedPlace(placeId));
  const [notes, setNotes] = useState(place?.notes ?? "");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    const next = getLiveSavedPlace(placeId);
    setPlace(next);
    if (next) setNotes(next.notes);
  }, [placeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!place) return;
      if (notes === place.notes) return;
      updateLiveSavedPlaceNotes(place.id, notes);
      reload();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [notes, place, reload]);

  const handleFiles = async (files: FileList | null, kind: "photo" | "audio" | "file") => {
    if (!place || !files?.length) return;
    for (const file of Array.from(files)) {
      if (kind === "photo" && !file.type.startsWith("image/")) continue;
      if (kind === "audio" && !file.type.startsWith("audio/")) continue;
      await addLiveSavedPlaceAttachment(place.id, file);
    }
    reload();
  };

  const handleRemovePlace = async () => {
    await removeLiveSavedPlace(placeId);
    onClose();
  };

  if (!place) return null;

  const surfaceClass = isPhoneLayout ? LIVE_GLASS_SHEET : LIVE_GLASS_SIDE_PANEL;

  return (
    <div
      className={`${surfaceClass} pointer-events-auto fixed z-[260] flex max-h-[min(70vh,28rem)] w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden live-panel-enter`}
      style={
        wayraChatOpen && !isPhoneLayout
          ? { right: "max(1rem, min(5.75rem, 6vw))", bottom: "5.5rem" }
          : { right: "1rem", bottom: "5.5rem" }
      }
      role="dialog"
      aria-label="Saved place"
    >
      <div className="flex items-start gap-2 border-b border-stone-100 px-3 py-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-primary">
          <Bookmark className="h-3.5 w-3.5 fill-current" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-stone-900">{place.name}</h3>
          <p className="truncate text-xs text-stone-500">
            {place.categoryLabel}
            {place.address ? ` · ${place.address.split(",")[0]}` : ""}
          </p>
          <p className="mt-0.5 text-[10px] text-stone-400">
            Saved on this device · {formatSavedDate(place.savedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
          aria-label="Close saved place"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div>
          <label
            htmlFor={`saved-notes-${place.id}`}
            className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500"
          >
            <FileText className="h-3 w-3" />
            Your notes
          </label>
          <textarea
            id={`saved-notes-${place.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comments, reminders, packing list…"
            rows={4}
            className="w-full resize-none rounded-xl border border-stone-200/80 bg-white/90 px-2.5 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/15"
          />
          <p className="mt-1 text-[10px] text-stone-400">
            Stored only in this browser — Rovvy servers never see this.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            Attachments
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:border-primary/30"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Photo
            </button>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:border-primary/30"
            >
              <Mic className="h-3.5 w-3.5" />
              Audio
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:border-primary/30"
            >
              <Paperclip className="h-3.5 w-3.5" />
              File
            </button>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files, "photo")}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files, "audio")}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files, "file")}
          />

          {place.attachments.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {place.attachments.map((att) => (
                <AttachmentRow
                  key={att.id}
                  placeId={place.id}
                  attachment={att}
                  onRemoved={reload}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-stone-500">No photos or files yet.</p>
          )}
        </div>
      </div>

      <div className="border-t border-stone-100 px-3 py-2">
        <button
          type="button"
          onClick={() => void handleRemovePlace()}
          className="w-full rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Remove from my map
        </button>
      </div>
    </div>
  );
}
