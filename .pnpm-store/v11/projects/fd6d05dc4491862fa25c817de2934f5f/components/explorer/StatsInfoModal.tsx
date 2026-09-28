"use client";

import { useEffect } from "react";
import { X, Globe, ShieldCheck, DollarSign } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StatsModalPayload =
  | {
      type: "safety";
      city: string;
      score: number | null;
    }
  | {
      type: "currency";
      fromCode: string;
      toCode: string;
      rate: number | null;
    };

type StatsInfoModalProps = {
  payload: StatsModalPayload | null;
  onClose: () => void;
  /** Called when user taps a link — opens in in-app browser instead of new tab */
  onOpenBrowser: (url: string, title: string, domain: string) => void;
};

// ─── Safety score interpretation ─────────────────────────────────────────────
function safetyLabel(score: number | null): { label: string; color: string; bg: string; bar: number } {
  if (score === null) return { label: "Unknown", color: "text-gray-400", bg: "bg-gray-600", bar: 0 };
  if (score >= 4.5) return { label: "Very Safe", color: "text-emerald-400", bg: "bg-emerald-500", bar: score / 5 };
  if (score >= 3.5) return { label: "Mostly Safe", color: "text-green-400", bg: "bg-green-500", bar: score / 5 };
  if (score >= 2.5) return { label: "Moderate Risk", color: "text-amber-400", bg: "bg-amber-500", bar: score / 5 };
  if (score >= 1.5) return { label: "Higher Risk", color: "text-orange-400", bg: "bg-orange-500", bar: score / 5 };
  return { label: "High Risk", color: "text-red-400", bg: "bg-red-500", bar: score / 5 };
}

// Mini SVG sparkline for currency trend
function CurrencySparkline({ up }: { up: boolean }) {
  const path = up
    ? "M 0,60 C 30,55 60,30 90,20 S 150,10 180,5"
    : "M 0,10 C 30,15 60,35 90,45 S 150,55 180,60";
  return (
    <svg viewBox="0 0 180 70" className="w-full h-16" fill="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? "#34d399" : "#f87171"} stopOpacity="0.4" />
          <stop offset="100%" stopColor={up ? "#34d399" : "#f87171"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} stroke={up ? "#34d399" : "#f87171"} strokeWidth="2.5" strokeLinecap="round" />
      <path d={`${path} L 180,70 L 0,70 Z`} fill="url(#sparkGrad)" opacity="0.5" />
    </svg>
  );
}

// ─── In-app browser link button ───────────────────────────────────────────────
function BrowserLinkButton({
  url,
  title,
  domain,
  label,
  className,
  onOpen,
}: {
  url: string;
  title: string;
  domain: string;
  label: string;
  className: string;
  onOpen: (url: string, title: string, domain: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(url, title, domain)}
      className={`flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold transition-colors ${className}`}
    >
      <Globe className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ─── Safety Panel ─────────────────────────────────────────────────────────────
function SafetyPanel({
  city,
  score,
  onOpenBrowser,
}: {
  city: string;
  score: number | null;
  onOpenBrowser: (url: string, title: string, domain: string) => void;
}) {
  const info = safetyLabel(score);
  const numbeoCity = city.trim().replace(/\s+/g, "-");
  const numbeoUrl = `https://www.numbeo.com/crime/in/${encodeURIComponent(numbeoCity)}`;
  const gpiUrl = `https://www.visionofhumanity.org/maps/`;

  const safetyTips = [
    { icon: "🏨", tip: "Stay in well-reviewed accommodation in central areas." },
    { icon: "🚕", tip: "Use official taxis or ride-share apps — avoid unmarked cabs." },
    { icon: "💳", tip: "Keep copies of your documents; use hotel safes for valuables." },
    { icon: "📱", tip: "Share your itinerary with someone you trust back home." },
    { icon: "🚶", tip: "Be extra cautious at night and in crowded tourist areas." },
  ];

  return (
    <div className="space-y-5">
      {/* Score card */}
      <div className="rounded-2xl bg-white/10 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white/70">Safety Rating</span>
          {score !== null && (
            <span className={`text-2xl font-black ${info.color}`}>{score.toFixed(1)} / 5</span>
          )}
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${info.bg}`}
            style={{ width: `${info.bar * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-sm font-bold ${info.color}`}>{info.label}</span>
          <span className="text-xs text-white/40">for {city}</span>
        </div>
      </div>

      {/* Safety tips */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">Traveller Tips</p>
        <div className="space-y-2">
          {safetyTips.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2.5">
              <span className="text-lg leading-none shrink-0 mt-0.5">{item.icon}</span>
              <p className="text-sm text-white/80 leading-relaxed">{item.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* In-app browser links */}
      <div className="space-y-2">
        <BrowserLinkButton
          url={`/explorer-panel/safety?city=${encodeURIComponent(city)}&score=${score ?? ""}`}
          title={`Safety & Crime — ${city}`}
          domain="safety · in-app"
          label="Open detailed safety view"
          className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          onOpen={onOpenBrowser}
        />

      </div>

      <p className="text-center text-xs text-white/25">
        Data source: Numbeo · Global Peace Index · UN UNODC
      </p>
    </div>
  );
}

// ─── Currency Panel ──────────────────────────────────────────────────────────
function CurrencyPanel({
  fromCode,
  toCode,
  rate,
  onOpenBrowser,
}: {
  fromCode: string;
  toCode: string;
  rate: number | null;
  onOpenBrowser: (url: string, title: string, domain: string) => void;
}) {
  const xeUrl = `https://www.xe.com/currencyconverter/convert/?Amount=1&From=${fromCode}&To=${toCode}`;
  const wiseUrl = `https://wise.com/us/currency-converter/${fromCode.toLowerCase()}-to-${toCode.toLowerCase()}-rate`;
  const isUSD = fromCode === "USD" && toCode === "USD";
  const mockTrend: "up" | "flat" | "down" = rate && rate > 1 ? "up" : "flat";

  const currencies: Record<string, { name: string; symbol: string; flag: string }> = {
    USD: { name: "US Dollar", symbol: "$", flag: "🇺🇸" },
    EUR: { name: "Euro", symbol: "€", flag: "🇪🇺" },
    GBP: { name: "British Pound", symbol: "£", flag: "🇬🇧" },
    INR: { name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
    JPY: { name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
    AUD: { name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
    CAD: { name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
    MXN: { name: "Mexican Peso", symbol: "MX$", flag: "🇲🇽" },
    CNY: { name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
    BRL: { name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  };

  const fromInfo = currencies[fromCode] || { name: fromCode, symbol: fromCode, flag: "💱" };
  const toInfo = currencies[toCode] || { name: toCode, symbol: toCode, flag: "💱" };

  return (
    <div className="space-y-5">
      {/* Rate card */}
      <div className="rounded-2xl bg-white/10 border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{fromInfo.flag}</span>
          <span className="text-white/60 font-medium text-sm">→</span>
          <span className="text-2xl">{toInfo.flag}</span>
        </div>
        <div className="mt-3">
          <p className="text-xs text-white/40 mb-1">
            {fromInfo.name} → {toInfo.name}
          </p>
          {rate !== null && !isUSD ? (
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black text-white">
                {toInfo.symbol}{rate.toFixed(2)}
              </span>
              <span className="mb-1 text-sm text-white/50">per {fromInfo.symbol}1</span>
            </div>
          ) : isUSD ? (
            <p className="text-sm text-white/50 mt-1">
              Your profile currency matches the destination. No conversion needed.
            </p>
          ) : (
            <p className="text-sm text-white/40 mt-1">Rate unavailable — tap XE below for live rate</p>
          )}
        </div>

        {!isUSD && (
          <div className="mt-3">
            <CurrencySparkline up={mockTrend === "up"} />
            <p className="text-center text-[10px] text-white/25">30-day trend (indicative)</p>
          </div>
        )}
      </div>

      {/* Quick conversions */}
      {rate !== null && !isUSD && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">Quick Reference</p>
          <div className="grid grid-cols-2 gap-2">
            {[5, 10, 50, 100, 500, 1000].map((amt) => (
              <div key={amt} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <span className="text-sm text-white/60">{fromInfo.symbol}{amt}</span>
                <span className="text-sm font-bold text-white">{toInfo.symbol}{(amt * rate).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-app browser links */}
      <div className="space-y-2">
        <BrowserLinkButton
          url={`/explorer-panel/currency?from=${fromCode}&to=${toCode}&rate=${rate ?? ""}`}
          title={`${fromCode} → ${toCode} Live Converter`}
          domain="currency · in-app"
          label="Open live currency converter"
          className="border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
          onOpen={onOpenBrowser}
        />

      </div>

      <p className="text-center text-xs text-white/25">
        Source: XE.com · Wise · Open Exchange Rates
      </p>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function StatsInfoModal({ payload, onClose, onOpenBrowser }: StatsInfoModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!payload) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [payload, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!payload) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [payload]);

  if (!payload) return null;

  const isSafety = payload.type === "safety";
  const title = isSafety
    ? `Safety — ${(payload as Extract<StatsModalPayload, { type: "safety" }>).city}`
    : `Currency · ${(payload as Extract<StatsModalPayload, { type: "currency" }>).fromCode} → ${(payload as Extract<StatsModalPayload, { type: "currency" }>).toCode}`;

  return (
    /* Backdrop — click outside to close */
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Panel */}
      <div className="relative w-full sm:max-w-md max-h-[90dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[#0F2942] border border-white/10 shadow-2xl flex flex-col">

        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
            {isSafety ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <DollarSign className="h-4 w-4 text-blue-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{title}</p>
            <p className="text-xs text-white/40">
              {isSafety ? "Numbeo · UN UNODC · GPI" : "XE.com · Wise"}
            </p>
          </div>
          {/* X button — closes the modal */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 [scrollbar-width:thin] [scrollbar-color:#1E293B_transparent]">
          {isSafety ? (
            <SafetyPanel
              city={(payload as Extract<StatsModalPayload, { type: "safety" }>).city}
              score={(payload as Extract<StatsModalPayload, { type: "safety" }>).score}
              onOpenBrowser={onOpenBrowser}
            />
          ) : (
            <CurrencyPanel
              fromCode={(payload as Extract<StatsModalPayload, { type: "currency" }>).fromCode}
              toCode={(payload as Extract<StatsModalPayload, { type: "currency" }>).toCode}
              rate={(payload as Extract<StatsModalPayload, { type: "currency" }>).rate}
              onOpenBrowser={onOpenBrowser}
            />
          )}
        </div>
      </div>
    </div>
  );
}
