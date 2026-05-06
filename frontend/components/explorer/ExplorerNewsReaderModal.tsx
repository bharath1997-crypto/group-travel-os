"use client";

import { MoreVertical, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type NewsReaderArticle = {
  url: string;
  title: string;
  domain?: string;
};

type ExplorerNewsReaderModalProps = {
  article: NewsReaderArticle | null;
  onClose: () => void;
};

function NewsReaderInner({
  article,
  onClose,
}: {
  article: NewsReaderArticle;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const clearHint = useCallback(() => {
    window.setTimeout(() => setHint(null), 2000);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = article.domain || "Article";
  const iframeTitle = article.title || label;

  const copyLink = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(article.url);
      setHint("Link copied");
      clearHint();
    } catch {
      setHint("Could not copy");
      clearHint();
    }
  };

  const share = async () => {
    setMenuOpen(false);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: article.title, url: article.url });
        return;
      }
      await navigator.clipboard.writeText(article.url);
      setHint("Link copied (share not available)");
      clearHint();
    } catch {
      setHint("Share cancelled");
      clearHint();
    }
  };

  const openExternal = () => {
    setMenuOpen(false);
    window.open(article.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-[#1E3A5F]"
      role="dialog"
      aria-modal="true"
      aria-label={iframeTitle}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[#1e4976] bg-[#162d4a] px-3 py-2.5 sm:px-4">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {label}
        </p>
        {hint ? (
          <span className="shrink-0 text-xs text-gray-300" role="status">
            {hint}
          </span>
        ) : null}
        <div className="relative shrink-0" ref={menuWrapRef}>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Article options"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e4976] bg-[#1E3A5F] text-gray-200 hover:text-white"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical className="h-5 w-5" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-10 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-[#1e4976] bg-[#162d4a] py-1 shadow-xl"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-[#1E3A5F]"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-[#1E3A5F]"
                onClick={() => void share()}
              >
                Share
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm text-[#E94560] hover:bg-[#1E3A5F]"
                onClick={openExternal}
              >
                Open in browser
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e4976] bg-[#1E3A5F] text-white hover:border-[#E94560]/50"
          onClick={onClose}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 bg-[#0d1f33] p-0">
        <iframe
          title={iframeTitle}
          src={article.url}
          className="h-[calc(100dvh-3.75rem)] w-full border-0 md:h-[80vh]"
        />
      </div>
    </div>
  );
}

export function ExplorerNewsReaderModal({
  article,
  onClose,
}: ExplorerNewsReaderModalProps) {
  if (!article) return null;
  return <NewsReaderInner key={article.url} article={article} onClose={onClose} />;
}
