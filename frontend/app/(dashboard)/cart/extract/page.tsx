"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Sparkles, 
  Link as LinkIcon, 
  MapPin, 
  ShoppingCart, 
  Loader2, 
  CheckCircle,
  Video,
  AlertTriangle
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type ExtractionResult = {
  extracted_place: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  confidence: "high" | "medium" | "low";
  platform: string;
  metadata: {
    title?: string;
    description?: string;
    thumbnail?: string;
    location?: string;
  };
};

export default function VideoExtractPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [added, setAdded] = useState(false);

  // Form submit handler to run extraction
  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setAdded(false);

    try {
      const data = await apiFetch<ExtractionResult>("/cart/extract-from-url", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract location details.");
    } finally {
      setLoading(false);
    }
  };

  // Handler to add the resolved location to the cart
  const handleAddToCart = async () => {
    if (!result || !result.extracted_place) return;
    setAddingToCart(true);
    setError(null);

    try {
      await apiFetch("/cart", {
        method: "POST",
        body: JSON.stringify({
          item_type: "activity",
          item_id: null,
          item_name: result.extracted_place,
          item_image: result.metadata.thumbnail || null,
          item_category: result.platform || "Video Extract",
          place_name: result.extracted_place,
          full_address: [result.city, result.country].filter(Boolean).join(", ") || result.extracted_place,
          lat: result.lat,
          lng: result.lng,
          price_range: null,
          rating: null,
          source: result.platform || "social_media",
          source_url: url.trim(),
        }),
      });
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Back Link */}
        <button
          onClick={() => router.push("/cart")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Travel Cart
        </button>

        {/* Header */}
        <div className="border-b border-slate-200 pb-5 mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-teal-700" />
            Social Location Extractor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Paste a link to an Instagram Reel, YouTube Short, or Google Maps location. Our AI parses descriptions, comments, and tags to extract the exact coordinates.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6">
          <form onSubmit={handleExtract} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Video or Maps Link
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste Instagram Reel, YouTube Short, or Google Maps link..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none transition-colors"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Supports: <span className="font-semibold text-slate-500">instagram.com/reel</span>, <span className="font-semibold text-slate-500">youtube.com/shorts</span>, <span className="font-semibold text-slate-500">maps.app.goo.gl</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-3 text-sm font-bold text-white hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting place details...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Extract Place details
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 mb-6">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-800">Extraction failed</p>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Video className="h-4 w-4 text-teal-700" />
                Parsed Metadata
              </span>
              <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-teal-700">
                {result.platform}
              </span>
            </div>

            <div className="p-5 space-y-5">
              {/* Media Preview */}
              {result.metadata && (result.metadata.title || result.metadata.thumbnail) && (
                <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {result.metadata.thumbnail && (
                    <img
                      src={result.metadata.thumbnail}
                      alt=""
                      className="h-20 w-20 object-cover rounded-lg shrink-0 border border-slate-200 bg-white"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                      {result.metadata.title || "Social Media Video"}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                      {result.metadata.description || "No description fetched."}
                    </p>
                  </div>
                </div>
              )}

              {/* Resolved Location */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Resolved Location
                </h4>

                {result.extracted_place ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-teal-50 p-2 text-teal-700 shrink-0">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {result.extracted_place}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[result.city, result.country].filter(Boolean).join(", ") || "Location recognized"}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold text-slate-400">
                          <span>Confidence: 
                            <span className={`ml-1 capitalize ${
                              result.confidence === "high" ? "text-emerald-600" :
                              result.confidence === "medium" ? "text-amber-600" : "text-red-500"
                            }`}>
                              {result.confidence}
                            </span>
                          </span>
                          <span>•</span>
                          <span>Lat: {result.lat.toFixed(5)}, Lng: {result.lng.toFixed(5)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      {added ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 py-3 text-sm font-semibold text-emerald-800">
                          <CheckCircle className="h-4 w-4 text-emerald-700" />
                          Saved to Cart!
                        </div>
                      ) : (
                        <button
                          onClick={handleAddToCart}
                          disabled={addingToCart}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-3 text-sm font-bold text-white hover:bg-teal-800 transition-colors disabled:opacity-50"
                        >
                          {addingToCart ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving to Cart...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="h-4 w-4" />
                              Add to Travel Cart
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
                    <p className="text-xs font-bold text-slate-800">No locations found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                      We couldn't resolve a specific point of interest or address from this link. Try another video or a direct Google Maps link.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
