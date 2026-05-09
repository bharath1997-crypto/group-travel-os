"use client";

import { useState } from "react";
import { X, Link as LinkIcon, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ShortsImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  city: string;
  onSuccess?: () => void;
};

export function ShortsImportModal({
  isOpen,
  onClose,
  city,
  onSuccess,
}: ShortsImportModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const tagsArray = hashtags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.startsWith("#") || t.length > 0)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));

      const response = await apiFetch<{ status: string; id: string }>(
        "/explorer/shorts/import",
        {
          method: "POST",
          body: JSON.stringify({
            url,
            city,
            title: title || undefined,
            hashtags: tagsArray.length > 0 ? tagsArray : undefined,
          }),
        }
      );

      if (response.status === "success") {
        setSuccess(true);
        setUrl("");
        setTitle("");
        setHashtags("");
        onSuccess?.();
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import short");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[#1e4976] bg-[#1E3A5F] p-6 shadow-xl shadow-black/40">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#E94560]" />
          <h2 className="text-xl font-bold text-white">Import Travel Short</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              YouTube URL *
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/shorts/..."
                className="w-full rounded-lg border border-[#1e4976] bg-[#162d4a] pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#E94560]/50 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              💡 Please ensure the link is for a vertical video (Shorts).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this short"
              className="w-full rounded-lg border border-[#1e4976] bg-[#162d4a] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#E94560]/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Hashtags (Optional, comma separated)
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="travel, chicago, food"
              className="w-full rounded-lg border border-[#1e4976] bg-[#162d4a] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#E94560]/50 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 font-medium">{error}</p>
          )}

          {success && (
            <p className="text-sm text-green-400 font-medium">
              Short imported successfully!
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#1e4976] bg-[#162d4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3554]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#E94560] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d83a54] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
