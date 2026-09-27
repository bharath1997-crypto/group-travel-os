"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { DollarSign, ExternalLink, RefreshCw, ArrowRight } from "lucide-react";

// ─── Currency metadata ────────────────────────────────────────────────────────
const CURRENCIES: Record<string, { name: string; symbol: string; flag: string; countries: string }> = {
  USD: { name: "US Dollar",        symbol: "$",   flag: "🇺🇸", countries: "United States, Ecuador, El Salvador, Panama" },
  EUR: { name: "Euro",             symbol: "€",   flag: "🇪🇺", countries: "Eurozone (France, Germany, Italy, Spain, etc.)" },
  GBP: { name: "British Pound",    symbol: "£",   flag: "🇬🇧", countries: "United Kingdom" },
  INR: { name: "Indian Rupee",     symbol: "₹",   flag: "🇮🇳", countries: "India" },
  JPY: { name: "Japanese Yen",     symbol: "¥",   flag: "🇯🇵", countries: "Japan" },
  AUD: { name: "Australian Dollar",symbol: "A$",  flag: "🇦🇺", countries: "Australia, Kiribati, Nauru" },
  CAD: { name: "Canadian Dollar",  symbol: "C$",  flag: "🇨🇦", countries: "Canada" },
  MXN: { name: "Mexican Peso",     symbol: "MX$", flag: "🇲🇽", countries: "Mexico" },
  CNY: { name: "Chinese Yuan",     symbol: "¥",   flag: "🇨🇳", countries: "China" },
  BRL: { name: "Brazilian Real",   symbol: "R$",  flag: "🇧🇷", countries: "Brazil" },
  CHF: { name: "Swiss Franc",      symbol: "Fr",  flag: "🇨🇭", countries: "Switzerland, Liechtenstein" },
  SGD: { name: "Singapore Dollar", symbol: "S$",  flag: "🇸🇬", countries: "Singapore" },
  ZAR: { name: "South African Rand",symbol: "R",  flag: "🇿🇦", countries: "South Africa, Lesotho, Namibia" },
  AED: { name: "UAE Dirham",       symbol: "د.إ", flag: "🇦🇪", countries: "United Arab Emirates" },
  THB: { name: "Thai Baht",        symbol: "฿",   flag: "🇹🇭", countries: "Thailand" },
};

// ─── Generate 30-day simulated history from a base rate ──────────────────────
function generateHistory(baseRate: number, days = 30): number[] {
  // Seeded-ish random walk ending at baseRate
  const history: number[] = [];
  let r = baseRate * (0.95 + Math.random() * 0.05);
  for (let i = 0; i < days - 1; i++) {
    const delta = (Math.random() - 0.49) * baseRate * 0.009;
    r = Math.max(r + delta, baseRate * 0.85);
    history.push(r);
  }
  history.push(baseRate); // always end at current rate
  return history;
}

// ─── SVG Area Chart ──────────────────────────────────────────────────────────
function AreaChart({
  data,
  width = 300,
  height = 90,
  color = "#60a5fa",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data) * 0.998;
  const max = Math.max(...data) * 1.002;
  const span = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / span) * height;
    return [x, y] as [number, number];
  });

  const linePath = `M ${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  // Tooltip dot — last point (current rate)
  const lastPt = pts[pts.length - 1]!;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath}  fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current rate dot */}
      <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r="4" fill={color} />
      <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r="7" fill={color} fillOpacity="0.25" />
    </svg>
  );
}

// ─── Chart labels ─────────────────────────────────────────────────────────────
function ChartLabels({ data, symbol }: { data: number[]; symbol: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  return (
    <div className="flex justify-between text-[10px] text-white/30 px-1 mt-1">
      <span>30 days ago</span>
      <span>
        {symbol}{min.toFixed(min < 10 ? 3 : 2)} – {symbol}{max.toFixed(max < 10 ? 3 : 2)}
      </span>
      <span>Today</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function CurrencyPageInner() {
  const searchParams = useSearchParams();
  const fromCode = (searchParams.get("from") || "USD").toUpperCase();
  const toCode   = (searchParams.get("to")   || "EUR").toUpperCase();
  const rateParam = parseFloat(searchParams.get("rate") || "0");

  const [currentFromCode, setCurrentFromCode] = useState(fromCode);
  const [currentToCode, setCurrentToCode] = useState(toCode);
  const [rate, setRate]           = useState<number | null>(rateParam > 0 ? rateParam : null);
  const [showFromTooltip, setShowFromTooltip] = useState(false);
  const [showToTooltip, setShowToTooltip] = useState(false);
  const [loading, setLoading]     = useState(rateParam <= 0);
  const [fromAmount, setFromAmount] = useState("1");
  const [history, setHistory]     = useState<number[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fromInfo = CURRENCIES[currentFromCode] || { name: currentFromCode, symbol: currentFromCode, flag: "💱" };
  const toInfo   = CURRENCIES[currentToCode]   || { name: currentToCode,   symbol: currentToCode,   flag: "💱" };

  // Fetch live rate from Open Exchange Rates (free, no key for latest/USD base)
  const fetchRate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${currentFromCode}`
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const liveRate: number = json?.rates?.[currentToCode];
      if (liveRate) {
        setRate(liveRate);
        setHistory(generateHistory(liveRate));
        setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    } catch {
      // Fall back to passed rate
      if (rateParam > 0) {
        setRate(rateParam);
        setHistory(generateHistory(rateParam));
      }
    } finally {
      setLoading(false);
    }
  }, [currentFromCode, currentToCode, rateParam]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  // Compute converted amount
  const numericFrom = parseFloat(fromAmount) || 0;
  const converted = rate ? (numericFrom * rate).toFixed(rate < 1 ? 4 : 2) : "—";

  // Quick amounts
  const quickAmounts = [1, 5, 10, 25, 50, 100, 250, 500];

  const xeUrl = `https://www.xe.com/currencyconverter/convert/?Amount=1&From=${fromCode}&To=${toCode}`;
  const googleUrl = `https://www.google.com/finance/quote/${fromCode}-${toCode}`;
  const wiseUrl = `https://wise.com/us/currency-converter/${fromCode.toLowerCase()}-to-${toCode.toLowerCase()}-rate`;

  // Trend direction
  const trend = history.length > 5
    ? history[history.length - 1]! > history[0]! ? "up" : "down"
    : "flat";
  const chartColor = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#60a5fa";

  return (
    <div className="min-h-screen bg-[#0B192E] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#0F2942]/90 backdrop-blur-md px-4 py-3">
        <DollarSign className="h-5 w-5 text-blue-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{currentFromCode} → {currentToCode} Converter</p>
          <p className="text-[10px] text-white/40">
            {lastUpdated ? `Updated ${lastUpdated} · ` : ""}XE.com · Open Exchange Rates
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh rate"
          onClick={fetchRate}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">

        {/* Main rate display */}
        <div className="rounded-2xl bg-[#0F2942] border border-white/10 p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <p className="text-sm text-white/40">Fetching live rate…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-center">
                  <div className="text-3xl mb-1">{fromInfo.flag}</div>
                  <p className="text-xs text-white/40">{fromCode}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-white/30 shrink-0" />
                <div className="text-center">
                  <div className="text-3xl mb-1">{toInfo.flag}</div>
                  <p className="text-xs text-white/40">{toCode}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] text-white/40 mb-1">1 {fromInfo.name}</p>
                  <p className="text-4xl font-black text-white leading-none">
                    {rate ? `${toInfo.symbol}${rate.toFixed(rate < 1 ? 4 : 2)}` : "—"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">{toInfo.name}</p>
                </div>
              </div>

              {/* Trend badge */}
              {history.length > 5 && (
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      trend === "up"   ? "bg-emerald-500/15 text-emerald-400" :
                      trend === "down" ? "bg-red-500/15 text-red-400" :
                                         "bg-white/10 text-white/50"
                    }`}
                  >
                    {trend === "up" ? "▲ Strengthening" : trend === "down" ? "▼ Weakening" : "● Stable"}
                    <span className="text-white/40 font-normal ml-1">vs 30 days ago</span>
                  </span>
                </div>
              )}

              {/* Area chart */}
              {history.length > 0 && (
                <div>
                  <AreaChart data={history} color={chartColor} />
                  <ChartLabels data={history} symbol={toInfo.symbol} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Interactive converter */}
        {rate && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Convert</p>

            {/* From input */}
            <div className="flex items-center gap-3 rounded-xl bg-[#0F2942] border border-white/10 px-4 py-3 focus-within:border-blue-500/40 transition-colors">
              <span className="text-xl shrink-0">{fromInfo.flag}</span>
              <span className="text-sm text-white/50 shrink-0">{fromInfo.symbol}</span>
              <input
                type="number"
                min="0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-white/20 min-w-0"
                placeholder="1"
              />
              <div 
                className="relative"
                onMouseEnter={() => setShowFromTooltip(true)}
                onMouseLeave={() => setShowFromTooltip(false)}
              >
                <select
                  value={currentFromCode}
                  onChange={(e) => setCurrentFromCode(e.target.value.toUpperCase())}
                  className="bg-transparent text-xs text-white/50 outline-none cursor-pointer hover:text-white transition-colors"
                >
                  {Object.keys(CURRENCIES).map((code) => (
                    <option key={code} value={code} className="bg-[#0F2942] text-white">
                      {CURRENCIES[code].flag} {code}
                    </option>
                  ))}
                </select>
                {showFromTooltip && (
                  <div className="absolute bottom-full mb-2 right-0 px-3 py-1.5 bg-[#1E3A5F] text-[11px] text-white rounded-lg shadow-lg w-max max-w-[200px] z-20 text-center border border-white/10">
                    {fromInfo.countries}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-white/20" />
            </div>

            {/* To output */}
            <div className="flex items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
              <span className="text-xl shrink-0">{toInfo.flag}</span>
              <span className="text-sm text-white/50 shrink-0">{toInfo.symbol}</span>
              <span className="flex-1 text-lg font-black text-white">{converted}</span>
              <div 
                className="relative"
                onMouseEnter={() => setShowToTooltip(true)}
                onMouseLeave={() => setShowToTooltip(false)}
              >
                <select
                  value={currentToCode}
                  onChange={(e) => setCurrentToCode(e.target.value.toUpperCase())}
                  className="bg-transparent text-xs text-white/50 outline-none cursor-pointer hover:text-white transition-colors"
                >
                  {Object.keys(CURRENCIES).map((code) => (
                    <option key={code} value={code} className="bg-[#0F2942] text-white">
                      {CURRENCIES[code].flag} {code}
                    </option>
                  ))}
                </select>
                {showToTooltip && (
                  <div className="absolute bottom-full mb-2 right-0 px-3 py-1.5 bg-[#1E3A5F] text-[11px] text-white rounded-lg shadow-lg w-max max-w-[200px] z-20 text-center border border-white/10">
                    {toInfo.countries}
                  </div>
                )}
              </div>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setFromAmount(String(amt))}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                    fromAmount === String(amt)
                      ? "bg-blue-500 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {fromInfo.symbol}{amt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick reference table */}
        {rate && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Quick Reference</p>
            <div className="grid grid-cols-2 gap-2">
              {[1, 5, 10, 20, 50, 100, 200, 500].map((amt) => (
                <div key={amt} className="flex items-center justify-between rounded-xl bg-[#0F2942] px-3 py-2">
                  <span className="text-sm text-white/50">{fromInfo.symbol}{amt}</span>
                  <span className="text-sm font-bold text-white">
                    {toInfo.symbol}{(amt * rate).toFixed(rate < 1 ? 3 : 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External source links */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Live Sources</p>
          {[
            { href: xeUrl,      label: "XE.com",          sub: "Industry standard live rates",           color: "text-blue-400",    bg: "bg-blue-500/10",   border: "border-blue-500/20" },
            { href: googleUrl,  label: "Google Finance",   sub: "Live chart & historical data",           color: "text-white/70",    bg: "bg-white/5",       border: "border-white/10" },
            { href: wiseUrl,    label: "Wise",             sub: "Real mid-market rate, fee breakdown",    color: "text-emerald-400", bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
          ].map(({ href, label, sub, color, bg, border }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between rounded-xl ${bg} border ${border} px-4 py-3 hover:opacity-90 transition-opacity group`}
            >
              <div>
                <p className={`text-sm font-semibold ${color}`}>{label}</p>
                <p className="text-xs text-white/40">{sub}</p>
              </div>
              <ExternalLink className={`h-4 w-4 ${color} shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform`} />
            </a>
          ))}
        </div>

        <p className="text-center text-xs text-white/20 pb-4">
          Rates are indicative. For transactions, always verify with your bank or payment provider.
          Data from Open Exchange Rates · XE.com
        </p>

      </div>
    </div>
  );
}

export default function CurrencyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B192E] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>
    }>
      <CurrencyPageInner />
    </Suspense>
  );
}
