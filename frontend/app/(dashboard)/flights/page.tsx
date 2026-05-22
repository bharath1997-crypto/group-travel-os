"use client";

import { useEffect } from "react";
import { Plane, Globe, Shield } from "lucide-react";

export default function FlightsPage() {
  useEffect(() => {
    const container = document.getElementById("tp-widget-container");
    if (!container) return;

    // Reset container contents to prevent double renders
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&show_hotels=true&powered_by=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2332a8dd&color_icons=%2332a8dd&color_text=%23FFFFFF&color_bg=%23FFFFFF&color_bg_search=%231F2326&color_border=%23C4C4C4&color_focused=%2332a8dd&border_radius=0&plain=false&promo_id=7879&campaign_id=100";
    script.charset = "utf-8";
    script.async = true;

    container.appendChild(script);
  }, []);

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#0F172A] rounded-3xl p-6 md:p-8 lg:p-10 text-white shadow-2xl border border-[#1E293B]">
      {/* Header Section */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-teal-900/40 flex items-center justify-center border border-teal-700/30">
            <Plane className="h-5 w-5 text-teal-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Rovvy Flights</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-teal-100 to-teal-400 bg-clip-text text-transparent">
          Flights
        </h1>
        <p className="mt-2 text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
          Search and compare flights from 728+ airlines worldwide
        </p>
      </div>

      {/* Widget Container */}
      <div className="max-w-4xl mx-auto bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden p-4 shadow-xl">
        <div id="tp-widget-container" className="w-full flex justify-center min-h-[300px]">
          {/* Script dynamically appends the search engine here */}
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-pulse">
            <Plane className="h-8 w-8 text-teal-500/50 mb-3 animate-bounce" />
            <p className="text-sm">Loading flight search engine...</p>
          </div>
        </div>
      </div>

      {/* Fallback / Footer Section */}
      <div className="max-w-4xl mx-auto mt-8 border-t border-[#1E293B] pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-teal-500" /> Powered by Travelpayouts
          </span>
          <span>·</span>
          <span>728+ airlines</span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-teal-500" /> Best price guarantee
          </span>
        </div>
        <a
          href="https://www.aviasales.com/?marker=727732"
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-400 hover:text-teal-300 hover:underline font-semibold transition"
        >
          Having trouble? Try searching directly →
        </a>
      </div>
    </div>
  );
}
