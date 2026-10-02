"use client";

import { useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";
import styles from "../explore.module.css";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

/** "Add a photo" for an Explore place. Uploads are reviewed before they appear. */
export function ExploreDrawerPhotoUpload({ placeId }: { placeId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const signedIn = Boolean(getToken());

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setState({ kind: "error", message: "Photo is larger than 10 MB." });
      return;
    }
    setState({ kind: "uploading" });
    const body = new FormData();
    body.append("file", file);
    try {
      // Not apiFetch: it forces a JSON Content-Type, which breaks multipart uploads.
      const res = await fetch(`${API_BASE}/explore/places/${encodeURIComponent(placeId)}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body,
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
      if (!res.ok) {
        setState({ kind: "error", message: payload.detail || `Upload failed (${res.status}).` });
        return;
      }
      setState({ kind: "done", message: payload.message || "Thanks! Your photo will appear after review." });
    } catch {
      setState({ kind: "error", message: "Upload failed. Check your connection and try again." });
    }
  }

  if (!signedIn) {
    return (
      <p className={styles.drawerUploadNote}>
        <a href="/login?next=%2Fexplore" className={styles.drawerChip}>
          Sign in to add a photo
        </a>
      </p>
    );
  }

  return (
    <div className={styles.drawerUpload}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className={styles.drawerChip}
        onClick={() => inputRef.current?.click()}
        disabled={state.kind === "uploading" || state.kind === "done"}
      >
        {state.kind === "uploading" ? "Uploading…" : state.kind === "done" ? "Photo submitted" : "Add a photo"}
      </button>
      <p className={styles.drawerUploadNote} role={state.kind === "error" ? "alert" : undefined}>
        {state.kind === "done" || state.kind === "error"
          ? state.message
          : "Reviewed before it appears. Location data is removed from the file."}
      </p>
    </div>
  );
}
