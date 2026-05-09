"use client";

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, DollarSign, ArrowLeftRight, TrendingUp, Info, X } from "lucide-react";

type TravelInfo = {
  city: string;
  country_code: string;
  safety: {
    score: number;
    level: string;
    description: string;
    updated_at: string;
  } | null;
  city_crime: {
    rating: string;
    advice: string;
  } | null;
  currency: {
    destination_currency: string;
    user_currency: string;
    rate: number;
    inverse_rate: number;
    symbol: string;
  } | null;
};

export function CurrencySafetyWidget({
  info,
  minimal = false,
}: {
  info: TravelInfo;
  minimal?: boolean;
}) {
  const [showConverter, setShowConverter] = useState(false);
  const [userVal, setUserVal] = useState("1");
  const [destVal, setDestVal] = useState("");

  if (!info.safety && !info.currency) return null;

  const safety = info.safety;
  const currency = info.currency;

  const handleUserChange = (val: string) => {
    setUserVal(val);
    if (!currency) return;
    const num = parseFloat(val) || 0;
    setDestVal((num * currency.inverse_rate).toFixed(2));
  };

  const handleDestChange = (val: string) => {
    setDestVal(val);
    if (!currency) return;
    const num = parseFloat(val) || 0;
    setUserVal((num * currency.rate).toFixed(2));
  };

  return (
    <div className="border-b border-[#1e4976]/50 bg-gradient-to-r from-[#0d1f33] to-[#071221] px-4 py-2 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!minimal && safety && (
            <div 
              className={`group relative flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition-all cursor-help ${
                safety.score < 2
                  ? "bg-green-500/10 text-green-400 ring-green-500/20"
                  : safety.score < 3.5
                    ? "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20"
                    : "bg-red-500/10 text-red-400 ring-red-500/20"
              }`}
            >
              {safety.score < 3 ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              <span>{safety.level}</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-[#0F3460] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Travel Advisory</p>
                <p className="text-white font-medium mb-2">{safety.description}</p>
                <p className="text-[9px] text-gray-500 italic">Updated: {safety.updated_at}</p>
              </div>
            </div>
          )}

          {/* City Safety Pill */}
          {info.city_crime && (
            <div 
              className={`group relative flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition-all cursor-help bg-purple-500/10 text-purple-400 ring-purple-500/20`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>{info.city} Safety</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-0 mb-2 w-72 p-4 bg-[#0F3460] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#E94560]">City Safety Report</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-[9px] border border-purple-500/30 uppercase">{info.city_crime.rating} Risk</span>
                </div>
                <p className="text-white text-xs leading-relaxed max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {info.city_crime.advice}
                </p>
              </div>
            </div>
          )}

          {currency && (
            <button
              onClick={() => setShowConverter(true)}
              className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 ring-1 ring-inset ring-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>
                {minimal
                  ? "Open currency converter"
                  : `1 ${currency.destination_currency} = ${currency.rate.toFixed(3)} ${currency.user_currency}`}
              </span>
              <ArrowLeftRight className="h-3 w-3 opacity-50 ml-1" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-gray-500 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Live updates via TravelAdvisory & ExchangeRate API
        </p>
      </div>

      {/* Google-Style Currency Converter Overlay */}
      {showConverter && currency && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0F3460] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Currency Converter</h3>
                <p className="text-gray-400 text-xs">Live exchange rates</p>
              </div>
              <button onClick={() => setShowConverter(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* User Side */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#E94560] ml-1">{currency.user_currency} (Preferred)</label>
                <div className="flex items-center gap-4 bg-black/30 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
                  <span className="text-2xl text-blue-400 font-bold">{currency.symbol}</span>
                  <input 
                    type="number" 
                    value={userVal}
                    onChange={(e) => handleUserChange(e.target.value)}
                    className="bg-transparent text-white text-3xl font-bold w-full outline-none placeholder:text-white/10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-[#E94560] p-2 rounded-full shadow-lg border-4 border-[#0F3460]">
                  <ArrowLeftRight className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* Destination Side */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">{currency.destination_currency} (Destination)</label>
                <div className="flex items-center gap-4 bg-black/30 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
                  <span className="text-2xl text-gray-400 font-bold opacity-50">#</span>
                  <input 
                    type="number" 
                    value={destVal || currency.inverse_rate.toFixed(2)}
                    onChange={(e) => handleDestChange(e.target.value)}
                    className="bg-transparent text-white text-3xl font-bold w-full outline-none placeholder:text-white/10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                  <span>Rate: 1 {currency.user_currency} = {currency.inverse_rate.toFixed(4)} {currency.destination_currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
