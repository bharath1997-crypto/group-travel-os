"use client";

import { useEffect } from "react";
import { Plane, Globe, Shield, Calendar, Compass, Map } from "lucide-react";

export default function FlightsPage() {
  useEffect(() => {
    const loadWidget = (containerId: string, src: string) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Reset container contents to prevent double renders
      container.innerHTML = "";

      const script = document.createElement("script");
      script.src = src;
      script.charset = "utf-8";
      script.async = true;

      container.appendChild(script);
    };

    // 1. Search Form Widget
    loadWidget(
      "tp-widget-container",
      "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&show_hotels=true&powered_by=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2332a8dd&color_icons=%2332a8dd&color_text=%23FFFFFF&color_bg=%23FFFFFF&color_bg_search=%231F2326&color_border=%23C4C4C4&color_focused=%2332a8dd&border_radius=0&plain=false&promo_id=7879&campaign_id=100"
    );

    // 2. Pricing Calendar Widget
    loadWidget(
      "tp-widget-pricing-calendar",
      "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&searchUrl=www.aviasales.com%2Fsearch&locale=en&powered_by=true&one_way=false&only_direct=false&period=year&range=7%2C14&origin=CHI&promo_id=4041&campaign_id=100"
    );

    // 3. Schedule Widget
    loadWidget(
      "tp-widget-schedule",
      "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&color_button=%2332a8dd&target_host=www.aviasales.com%2Fsearch&locale=en&powered_by=true&one_way=false&only_direct=false&period=year&range=7%2C14&origin=CHI&destination=LON&promo_id=2811&campaign_id=100"
    );

    // 4. Popular Routes Widget
    loadWidget(
      "tp-widget-popular-routes",
      "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&destination=CHI&target_host=www.aviasales.com%2Fsearch&locale=en&limit=6&powered_by=true&primary=%2332a8dd&promo_id=4044&campaign_id=100"
    );

    // 5. Prices on Map Widget
    loadWidget(
      "tp-widget-map",
      "https://tpwdg.com/content?currency=usd&trs=528092&shmarker=727732&lat=41.8781&lng=-87.6298&powered_by=true&search_host=www.aviasales.com%2Fsearch&origin_iata=CHI&destination_iata=&one_way=false&only_direct=false&locale=en&period=year&range=7%2C14&theme=light&draggable=true&disable_zoom=false&show_buttons=true&scroll_zoom=false&zoom=3&width=100%25&height=500px&type=map&promo_id=4054"
    );
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
          Flights Discovery Hub
        </h1>
        <p className="mt-2 text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
          Search and compare flights, analyze prices across dates, check flight routes, and map out cheap journeys around the globe.
        </p>
      </div>

      {/* Main Search Widget Container */}
      <div className="max-w-4xl mx-auto bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden p-4 shadow-xl">
        <div id="tp-widget-container" className="w-full flex justify-center min-h-[300px]">
          {/* Script dynamically appends the search engine here */}
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-pulse">
            <Plane className="h-8 w-8 text-teal-500/50 mb-3 animate-bounce" />
            <p className="text-sm">Loading flight search engine...</p>
          </div>
        </div>
      </div>

      {/* Section: Find the Best Time to Fly */}
      <div className="max-w-4xl mx-auto mt-16 mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-lg bg-teal-900/30 flex items-center justify-center border border-teal-800/30">
            <Calendar className="h-4 w-4 text-teal-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Find the Best Time to Fly</h2>
        </div>
        <p className="text-xs md:text-sm text-[#94A3B8] ml-10">
          Compare prices across dates to find the cheapest day to fly
        </p>
      </div>
      <div className="max-w-4xl mx-auto bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden p-4 shadow-xl mb-12">
        <div id="tp-widget-pricing-calendar" className="w-full flex justify-center min-h-[250px]">
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse">
            <Plane className="h-7 w-7 text-teal-500/50 mb-2 animate-bounce" />
            <p className="text-xs">Loading pricing calendar...</p>
          </div>
        </div>
      </div>

      {/* Section: Flight Schedules */}
      <div className="max-w-4xl mx-auto mt-12 mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-lg bg-teal-900/30 flex items-center justify-center border border-teal-800/30">
            <Shield className="h-4 w-4 text-teal-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Flight Schedules</h2>
        </div>
        <p className="text-xs md:text-sm text-[#94A3B8] ml-10">
          View all available flights on your chosen route
        </p>
      </div>
      <div className="max-w-4xl mx-auto bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden p-4 shadow-xl mb-12">
        <div id="tp-widget-schedule" className="w-full flex justify-center min-h-[250px]">
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse">
            <Plane className="h-7 w-7 text-teal-500/50 mb-2 animate-bounce" />
            <p className="text-xs">Loading flight schedules...</p>
          </div>
        </div>
      </div>

      {/* Section: Popular Routes from Chicago */}
      <div className="max-w-4xl mx-auto mt-12 mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-lg bg-teal-900/30 flex items-center justify-center border border-teal-800/30">
            <Compass className="h-4 w-4 text-teal-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Popular Routes from Chicago</h2>
        </div>
        <p className="text-xs md:text-sm text-[#94A3B8] ml-10">
          Discover the cheapest destinations from your city
        </p>
      </div>
      <div className="max-w-4xl mx-auto bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden p-4 shadow-xl mb-12">
        <div id="tp-widget-popular-routes" className="w-full flex justify-center min-h-[250px]">
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse">
            <Plane className="h-7 w-7 text-teal-500/50 mb-2 animate-bounce" />
            <p className="text-xs">Loading popular routes...</p>
          </div>
        </div>
      </div>

      {/* Section: Explore Prices on the Map */}
      <div className="max-w-4xl mx-auto mt-12 mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-lg bg-teal-900/30 flex items-center justify-center border border-teal-800/30">
            <Map className="h-4 w-4 text-teal-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Explore Prices on the Map</h2>
        </div>
        <p className="text-xs md:text-sm text-[#94A3B8] ml-10">
          Find cheap flights to anywhere in the world
        </p>
      </div>
      <div className="max-w-4xl mx-auto bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden p-4 shadow-xl mb-12">
        <div id="tp-widget-map" className="w-full flex justify-center min-h-[500px]">
          <div className="flex flex-col items-center justify-center py-32 text-slate-500 animate-pulse">
            <Plane className="h-8 w-8 text-teal-500/50 mb-3 animate-bounce" />
            <p className="text-sm">Loading interactive flight map...</p>
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

