"use client";

import { useState } from "react";

import type { LinkPreview as Preview } from "./collection-types";
import styles from "./collection.module.css";

type Props = { preview: Preview; title: string; url: string };

/**
 * What the pasted link is. Nothing here is stored.
 * YouTube: the thumbnail is shown whole and unaltered, and the video plays only in
 * YouTube's own embedded player after a tap (no autoplay), with the required links.
 * Other platforms: label only; Rovvy does not read or embed them.
 */
export default function LinkPreview({ preview, title, url }: Props) {
  const [playing, setPlaying] = useState(false);
  const isYouTube = preview.platform === "YouTube" && Boolean(preview.video_id);

  return (
    <div className={styles.linkPreview}>
      {isYouTube && preview.video_id ? (
        playing ? (
          <iframe
            className={styles.previewPlayer}
            src={`https://www.youtube.com/embed/${encodeURIComponent(preview.video_id)}?rel=0`}
            title={title || "YouTube video"}
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : preview.thumbnail_url ? (
          <button type="button" className={styles.previewThumbBtn} onClick={() => setPlaying(true)} aria-label={`Play ${title || "video"} here`}>
            {/* Hot-linked and shown whole: YouTube's rules forbid cropping or altering it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.thumbnail_url} alt="" referrerPolicy="strict-origin-when-cross-origin" className={styles.previewThumb} />
            <span className={styles.previewPlay} aria-hidden>
              ▶
            </span>
          </button>
        ) : null
      ) : null}
      <div className={styles.previewMeta}>
        <span className={styles.previewTitle}>{title}</span>
        <span className={`${styles.previewSub} ${styles.mono}`}>
          {preview.platform ?? "Link"}
          {preview.author ? ` · ${preview.author}` : ""}
        </span>
        <span className={styles.previewLinks}>
          <a href={url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
            Open original
          </a>
          {isYouTube ? (
            <>
              {" · "}
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                YouTube Terms of Service
              </a>
              {" · "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                Google Privacy Policy
              </a>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
