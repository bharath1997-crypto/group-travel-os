"use client";

import { MoreVertical, X, RefreshCw, ExternalLink } from "lucide-react";
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
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const clearHint = useCallback(() => {
    window.setTimeout(() => setHint(null), 2000);
  }, []);

  // Lock scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Collapse menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // Detect if iframe was actually blocked — use a timeout heuristic
  // (we can't read X-Frame-Options from JS, but if the iframe loads 0px content
  //  within 4s we show the fallback)
  useEffect(() => {
    setIframeBlocked(false);
    setIframeLoading(true);
    const timer = window.setTimeout(() => {
      // Check if iframe has any content — if it still shows as loading after 4s, likely blocked
      try {
        const doc = iframeRef.current?.contentDocument;
        if (!doc || doc.body?.innerHTML === "") {
          setIframeBlocked(true);
        }
      } catch {
        // Cross-origin block — this is expected for most sites
        // iframe is there but we can't read it — that means it IS loading (good)
        // So we do NOT set blocked here
      }
      setIframeLoading(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [article.url]);

  const handleIframeLoad = () => {
    setIframeLoading(false);
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || doc.body?.innerHTML === "") {
        setIframeBlocked(true);
      }
    } catch {
      // Cross-origin — page loaded fine (expected), don't set blocked
    }
  };

  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeBlocked(true);
  };

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

  const label = article.domain || new URL(article.url).hostname.replace("www.", "");
  const iframeTitle = article.title || label;

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-[#0B192E]"
      role="dialog"
      aria-modal="true"
      aria-label={iframeTitle}
    >
      {/* ── Browser chrome header ── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-[#1e4976] bg-[#0F2942] px-3 py-2.5 sm:px-4">
        {/* Close (X) button — leftmost, like Instagram */}
        <button
          type="button"
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e4976] bg-[#162d4a] text-white/70 hover:text-white hover:border-[#E94560]/50 transition-colors"
          onClick={onClose}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {/* URL / domain bar */}
        <div className="min-w-0 flex-1 rounded-lg border border-[#1e4976]/60 bg-[#071221] px-3 py-1.5">
          <p className="truncate text-xs font-medium text-gray-300">{label}</p>
          <p className="truncate text-[10px] text-gray-500">{article.url}</p>
        </div>

        {/* Hint toast */}
        {hint ? (
          <span className="shrink-0 text-xs text-gray-300" role="status">
            {hint}
          </span>
        ) : null}

        {/* Menu */}
        <div className="relative shrink-0" ref={menuWrapRef}>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Options"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e4976] bg-[#162d4a] text-gray-200 hover:text-white transition-colors"
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
                className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-[#1E3A5F] transition-colors"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-[#1E3A5F] transition-colors"
                onClick={() => void share()}
              >
                Share
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm text-[#E94560] hover:bg-[#1E3A5F] transition-colors"
                onClick={openExternal}
              >
                Open in browser
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Content area ── */}
      <div className="relative min-h-0 flex-1 bg-[#0B192E]">
        {/* Loading spinner */}
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B192E]">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-[#E94560]" />
              <p className="text-sm text-gray-400">Loading {label}…</p>
            </div>
          </div>
        )}

        {/* Blocked fallback */}
        {iframeBlocked ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#0B192E] px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e4976]/40">
              <ExternalLink className="h-7 w-7 text-[#E94560]" />
            </div>
            <div>
              <p className="text-base font-bold text-white">
                {label} doesn't allow in-app viewing
              </p>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                This website has blocked embedding for security reasons.
                Tap the button below to open it in your browser.
              </p>
            </div>
            <button
              type="button"
              onClick={openExternal}
              className="flex items-center gap-2 rounded-full bg-[#E94560] px-6 py-3 text-sm font-semibold text-white hover:bg-[#d63851] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open in browser
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title={iframeTitle}
            src={article.url}
            className="h-full w-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
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
