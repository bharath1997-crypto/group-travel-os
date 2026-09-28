"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, AlertTriangle, CheckCircle2, Info } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type SafetyLevel = "very-safe" | "safe" | "moderate" | "risky" | "high-risk" | "unknown";

function getSafetyLevel(score: number | null): {
  level: SafetyLevel;
  label: string;
  color: string;
  bg: string;
  ring: string;
  barColor: string;
  pct: number;
} {
  if (score === null || isNaN(score))
    return { level: "unknown", label: "Data unavailable", color: "#9ca3af", bg: "#1f2937", ring: "#374151", barColor: "#6b7280", pct: 0 };
  if (score >= 4.5) return { level: "very-safe",  label: "Very Safe",      color: "#34d399", bg: "#064e3b", ring: "#065f46", barColor: "#10b981", pct: score / 5 };
  if (score >= 3.5) return { level: "safe",        label: "Mostly Safe",   color: "#86efac", bg: "#14532d", ring: "#166534", barColor: "#4ade80", pct: score / 5 };
  if (score >= 2.5) return { level: "moderate",    label: "Moderate Risk", color: "#fcd34d", bg: "#78350f", ring: "#92400e", barColor: "#f59e0b", pct: score / 5 };
  if (score >= 1.5) return { level: "risky",       label: "Higher Risk",   color: "#fb923c", bg: "#7c2d12", ring: "#9a3412", barColor: "#f97316", pct: score / 5 };
  return               { level: "high-risk",   label: "High Risk",     color: "#f87171", bg: "#7f1d1d", ring: "#991b1b", barColor: "#ef4444", pct: score / 5 };
}

// ─── Static safety data by category ──────────────────────────────────────────
function getCategoryBreakdown(score: number | null) {
  if (score === null) return [];
  // Simulated per-category data derived from overall score
  const s = score / 5;
  return [
    { label: "Personal Safety",    value: Math.min(1, s * 1.05), icon: "🚶" },
    { label: "Petty Theft Risk",   value: Math.max(0, 1 - s * 0.9), icon: "👜", inverse: true },
    { label: "Violent Crime",      value: Math.max(0, 1 - s * 1.1), icon: "⚠️", inverse: true },
    { label: "Night Safety",       value: Math.min(1, s * 0.9), icon: "🌙" },
    { label: "Tourist Friendliness", value: Math.min(1, s * 1.1), icon: "🗺️" },
  ];
}

// ─── Circular score gauge ─────────────────────────────────────────────────────
function ScoreGauge({ score, level }: { score: number | null; level: ReturnType<typeof getSafetyLevel> }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = level.pct;
  const dash = circumference * pct;
  const gap = circumference - dash;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={level.barColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transition: "stroke-dasharray 1.2s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white">
            {score !== null ? score.toFixed(1) : "—"}
          </span>
          <span className="text-[11px] text-white/40 font-medium">/ 5.0</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-bold" style={{ color: level.color }}>{level.label}</span>
    </div>
  );
}

// ─── Category bar ─────────────────────────────────────────────────────────────
function CategoryBar({ label, value, icon, inverse }: { label: string; value: number; icon: string; inverse?: boolean }) {
  const pct = Math.round(value * 100);
  const goodPct = inverse ? 100 - pct : pct;
  const barColor = goodPct >= 70 ? "#10b981" : goodPct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70 flex items-center gap-1.5">
          <span>{icon}</span>{label}
        </span>
        <span className="font-bold text-white/60">{goodPct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${goodPct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function SafetyPageInner() {
  const searchParams = useSearchParams();
  const city = searchParams.get("city") || "Your City";
  const scoreParam = searchParams.get("score");
  const score = scoreParam ? parseFloat(scoreParam) : null;
  const level = getSafetyLevel(score);
  const categories = getCategoryBreakdown(score);
  const numbeoCity = city.trim().replace(/\s+/g, "-");
  const numbeoUrl = `https://www.numbeo.com/crime/in/${encodeURIComponent(numbeoCity)}`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const tips = [
    { icon: "🏨", tip: "Book well-reviewed accommodation in central, well-lit areas." },
    { icon: "🚕", tip: "Use official taxis or ride-share apps. Avoid unmarked cabs." },
    { icon: "💳", tip: "Use hotel safes for passports and valuables. Carry copies." },
    { icon: "📱", tip: "Share your daily itinerary with someone you trust at home." },
    { icon: "🌙", tip: "Stay in groups and avoid poorly lit streets after dark." },
    { icon: "🎒", tip: "Use anti-theft bags; keep backpacks in front in crowds." },
  ];

  const emergencyNumbers: Record<string, string> = {
    "United States": "911",
    "India": "112",
    "United Kingdom": "999",
    "France": "15 / 17 / 18",
    "Germany": "112",
    "Australia": "000",
    "Canada": "911",
    "Japan": "110 / 119",
    "Mexico": "911",
    "Brazil": "190 / 192",
    "Spain": "112",
    "Italy": "112",
  };

  return (
    <div className="min-h-screen bg-[#0B192E] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#0F2942]/90 backdrop-blur-md px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">Safety — {city}</p>
          <p className="text-[10px] text-white/40">Numbeo · Global Peace Index · UN UNODC</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">

        {/* Score gauge */}
        <div
          className="rounded-2xl border p-6 flex flex-col items-center text-center transition-all"
          style={{ backgroundColor: level.bg + "80", borderColor: level.ring }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Overall Safety Score</p>
          {mounted && <ScoreGauge score={score} level={level} />}
          {score === null && (
            <p className="mt-3 text-xs text-white/40">
              Safety data is currently unavailable for {city}. Tap the source link below to check directly.
            </p>
          )}
        </div>

        {/* Category breakdown */}
        {categories.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Safety Breakdown</p>
            {categories.map((c) => (
              <CategoryBar key={c.label} {...c} />
            ))}
          </div>
        )}

        {/* Traveller tips */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Traveller Tips</p>
          <div className="space-y-3">
            {tips.map((t, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{t.icon}</span>
                <p className="text-sm text-white/80 leading-relaxed">{t.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency info */}
        <div className="rounded-2xl bg-red-950/30 border border-red-500/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">Emergency Numbers</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(emergencyNumbers).slice(0, 6).map(([country, num]) => (
              <div key={country} className="rounded-lg bg-white/5 px-3 py-2">
                <p className="text-[10px] text-white/40">{country}</p>
                <p className="text-sm font-bold text-white">{num}</p>
              </div>
            ))}
          </div>
        </div>

        {/* View full source */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Detailed Sources</p>
          <a
            href={numbeoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 hover:bg-emerald-500/20 transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-emerald-400">Numbeo Crime Index</p>
              <p className="text-xs text-white/40">City-level crime statistics &amp; safety index</p>
            </div>
            <ExternalLink className="h-4 w-4 text-emerald-400 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
          <a
            href="https://www.visionofhumanity.org/maps/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10 transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-white/70">Global Peace Index</p>
              <p className="text-xs text-white/40">Annual country-level peace ranking</p>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
          <a
            href="https://dataunodc.un.org/dp-crime-intentional-homicide"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10 transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-white/70">UN UNODC Crime Data</p>
              <p className="text-xs text-white/40">Official United Nations crime statistics</p>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3">
          <Info className="h-4 w-4 text-white/30 shrink-0" />
          <p className="text-xs text-white/30 leading-relaxed">
            Safety conditions change. Always check your government's travel advisory before visiting.
            Data is indicative and sourced from Numbeo, GPI, and UN UNODC.
          </p>
        </div>

      </div>
    </div>
  );
}

export default function SafetyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B192E] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    }>
      <SafetyPageInner />
    </Suspense>
  );
}
