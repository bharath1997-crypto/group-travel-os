"use client";

import { useState, useRef, useEffect } from "react";

type HourlyData = {
  time: string;
  tempF: number;
  tempC: number;
  precip: number;
  wind: number;
};

type DailyData = {
  dayStr: string; // "Tue", "Wed"
  dateStr: string; // "May 5"
  icon: string;
  condition: string;
  highF: number;
  lowF: number;
  highC: number;
  lowC: number;
  precipProb: number;
  humidity: number;
  windSpeed: number;
  hourly: HourlyData[];
};

// Generate some mock 24-hour data for a day
function generateHourly(baseTempF: number): HourlyData[] {
  const times = [
    "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
    "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM"
  ];
  return times.map((time, i) => {
    // simple curve: coldest at 4 AM, hottest at 3 PM (15:00)
    const hour = i;
    let offset = 0;
    if (hour <= 4) offset = - (4 - hour);
    else if (hour <= 15) offset = (hour - 4) * 1.5;
    else offset = (15 - hour) + 16.5;
    
    const tempF = Math.round(baseTempF - 10 + offset);
    return {
      time,
      tempF,
      tempC: Math.round((tempF - 32) * (5 / 9)),
      precip: Math.floor(Math.random() * 40),
      wind: Math.floor(Math.random() * 15) + 5,
    };
  });
}

const MOCK_DAYS: DailyData[] = [
  { dayStr: "Tue", dateStr: "May 5", icon: "☁️", condition: "Cloudy", highF: 55, lowF: 45, highC: 13, lowC: 7, precipProb: 25, humidity: 43, windSpeed: 8, hourly: generateHourly(50) },
  { dayStr: "Wed", dateStr: "May 6", icon: "☁️", condition: "Mostly Cloudy", highF: 54, lowF: 42, highC: 12, lowC: 6, precipProb: 10, humidity: 50, windSpeed: 10, hourly: generateHourly(48) },
  { dayStr: "Thu", dateStr: "May 7", icon: "🌧️", condition: "Rain Showers", highF: 57, lowF: 44, highC: 14, lowC: 7, precipProb: 80, humidity: 75, windSpeed: 14, hourly: generateHourly(51) },
  { dayStr: "Fri", dateStr: "May 8", icon: "🌧️", condition: "Heavy Rain", highF: 63, lowF: 52, highC: 17, lowC: 11, precipProb: 95, humidity: 85, windSpeed: 18, hourly: generateHourly(58) },
  { dayStr: "Sat", dateStr: "May 9", icon: "🌧️", condition: "Scattered Showers", highF: 75, lowF: 51, highC: 24, lowC: 11, precipProb: 60, humidity: 65, windSpeed: 12, hourly: generateHourly(63) },
  { dayStr: "Sun", dateStr: "May 10", icon: "⛅", condition: "Partly Sunny", highF: 58, lowF: 48, highC: 14, lowC: 9, precipProb: 5, humidity: 40, windSpeed: 9, hourly: generateHourly(53) },
  { dayStr: "Mon", dateStr: "May 11", icon: "⛅", condition: "Partly Sunny", highF: 58, lowF: 51, highC: 14, lowC: 11, precipProb: 10, humidity: 45, windSpeed: 7, hourly: generateHourly(54) },
  { dayStr: "Tue", dateStr: "May 12", icon: "🌧️", condition: "Rain", highF: 73, lowF: 53, highC: 23, lowC: 12, precipProb: 70, humidity: 70, windSpeed: 15, hourly: generateHourly(63) },
];

export function WeatherWidget({
  isOpen,
  onClose,
  city,
}: {
  isOpen: boolean;
  onClose: () => void;
  city: string;
}) {
  const [unit, setUnit] = useState<"F" | "C">("F");
  const [activeTab, setActiveTab] = useState<"Temperature" | "Precipitation" | "Wind">("Temperature");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the current hour when opened
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const currentHour = new Date().getHours();
      // Estimate width per hour item (roughly 60px)
      scrollRef.current.scrollLeft = Math.max(0, (currentHour - 2) * 60);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDay = MOCK_DAYS[selectedDayIndex];
  // For the main display, show the current hour's temp if today, or high temp if future day
  const isToday = selectedDayIndex === 0;
  const currentHourIdx = isToday ? new Date().getHours() : 12; // default to noon for future days
  const currentHourData = currentDay.hourly[currentHourIdx] || currentDay.hourly[12];
  
  const displayTempF = isToday ? currentHourData.tempF : currentDay.highF;
  const displayTempC = isToday ? currentHourData.tempC : currentDay.highC;
  const mainTemp = unit === "F" ? displayTempF : displayTempC;

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors z-10 p-2"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex gap-4 items-center">
              <span className="text-7xl drop-shadow-md">{currentDay.icon}</span>
              <div className="flex items-start">
                <span className="text-6xl text-[#2C3E50] tracking-tighter">{mainTemp}</span>
                <div className="mt-1 ml-1 text-sm text-[#6C757D] font-medium flex gap-1">
                  <button onClick={() => setUnit("F")} className={`transition-colors ${unit === "F" ? "text-[#2C3E50] font-semibold" : "hover:text-[#2C3E50]"}`}>°F</button>
                  |
                  <button onClick={() => setUnit("C")} className={`transition-colors ${unit === "C" ? "text-[#2C3E50] font-semibold" : "hover:text-[#2C3E50]"}`}>°C</button>
                </div>
              </div>
              <div className="ml-4 flex flex-col justify-center text-[11px] text-[#6C757D]">
                <div className="group relative w-fit cursor-help">
                  <p>Precipitation: <span className="font-medium text-[#2C3E50]">{currentDay.precipProb}%</span></p>
                  <span className="absolute -top-8 left-0 hidden w-max rounded bg-gray-800 px-2 py-1 text-white group-hover:block z-20">Chance of rain today</span>
                </div>
                <div className="group relative w-fit cursor-help">
                  <p>Humidity: <span className="font-medium text-[#2C3E50]">{currentDay.humidity}%</span></p>
                  <span className="absolute -top-8 left-0 hidden w-max rounded bg-gray-800 px-2 py-1 text-white group-hover:block z-20">Moisture in the air</span>
                </div>
                <div className="group relative w-fit cursor-help">
                  <p>Wind: <span className="font-medium text-[#2C3E50]">{currentDay.windSpeed} mph</span></p>
                  <span className="absolute -top-8 left-0 hidden w-max rounded bg-gray-800 px-2 py-1 text-white group-hover:block z-20">Average wind speed</span>
                </div>
              </div>
            </div>
            <div className="md:text-right mt-2 md:mt-0">
              <h3 className="text-2xl text-[#2C3E50]">Weather</h3>
              <p className="text-sm text-[#6C757D]">{currentDay.dayStr}, {currentDay.dateStr}</p>
              <p className="text-sm text-[#6C757D]">{currentDay.condition}</p>
              <p className="mt-1.5 text-[10px] text-[#6C757D] bg-gray-100 px-2 py-0.5 rounded-full inline-block">
                {city} temp (41.8781° N, 87.6298° W)
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-6 border-b border-[#E9ECEF] text-sm text-[#6C757D] font-medium px-2">
            <button onClick={() => setActiveTab("Temperature")} className={`pb-3 transition-colors ${activeTab === "Temperature" ? "border-b-[3px] border-[#FCD34D] text-[#2C3E50] -mb-[1.5px]" : "hover:text-[#2C3E50]"}`}>Temperature</button>
            <button onClick={() => setActiveTab("Precipitation")} className={`pb-3 transition-colors ${activeTab === "Precipitation" ? "border-b-[3px] border-[#FCD34D] text-[#2C3E50] -mb-[1.5px]" : "hover:text-[#2C3E50]"}`}>Precipitation</button>
            <button onClick={() => setActiveTab("Wind")} className={`pb-3 transition-colors ${activeTab === "Wind" ? "border-b-[3px] border-[#FCD34D] text-[#2C3E50] -mb-[1.5px]" : "hover:text-[#2C3E50]"}`}>Wind</button>
          </div>

          {/* 24-Hour Graph Area */}
          <div className="mt-6 relative h-40 group">
            {/* Scroll Buttons */}
            <button onClick={scrollLeft} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full p-1 shadow hover:bg-white hidden group-hover:block">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button onClick={scrollRight} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full p-1 shadow hover:bg-white hidden group-hover:block">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>

            <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden custom-scrollbar snap-x h-full scroll-smooth">
              <div className="min-w-[1440px] h-full relative px-2 flex">
                {currentDay.hourly.map((h, i) => {
                  const val = activeTab === "Temperature" ? (unit === "F" ? h.tempF : h.tempC) :
                              activeTab === "Precipitation" ? h.precip : h.wind;
                  
                  const isCurrentHour = isToday && i === currentHourIdx;
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-between items-center relative h-full w-[60px] snap-center">
                      <span className={`text-xs font-semibold ${isCurrentHour ? "text-[#2C3E50]" : "text-[#6C757D]"}`}>
                        {val}{activeTab === "Precipitation" ? "%" : activeTab === "Wind" ? " mph" : ""}
                      </span>
                      
                      {/* Simple bar representation for non-temp tabs, or dot for temp */}
                      <div className="absolute top-8 bottom-8 left-0 right-0 flex items-end justify-center pb-2">
                        {activeTab === "Temperature" ? (
                           <div className={`w-2 h-2 rounded-full ${isCurrentHour ? "bg-[#2C3E50]" : "bg-[#FCD34D]"}`} style={{ marginBottom: `${(val - 30)*2}px` }} />
                        ) : (
                           <div className="w-8 bg-blue-100 rounded-t-sm" style={{ height: `${activeTab === "Precipitation" ? val : val*3}%` }}>
                             {activeTab === "Precipitation" && <div className="w-full bg-blue-400 rounded-t-sm" style={{ height: '100%' }} />}
                             {activeTab === "Wind" && <div className="w-full bg-gray-300 rounded-t-sm" style={{ height: '100%' }} />}
                           </div>
                        )}
                      </div>

                      <span className={`text-[10px] ${isCurrentHour ? "font-bold text-[#2C3E50] bg-gray-100 px-2 py-0.5 rounded-full" : "text-[#6C757D]"}`}>
                        {h.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weekly Forecast */}
          <div className="mt-2 border-t border-[#E9ECEF] pt-4 overflow-x-auto custom-scrollbar snap-x flex justify-between gap-2 px-2">
            {MOCK_DAYS.map((d, index) => {
              const isActive = index === selectedDayIndex;
              const high = unit === "F" ? d.highF : d.highC;
              const low = unit === "F" ? d.lowF : d.lowC;
              const hasRain = d.icon.includes("🌧️");
              
              return (
                <button 
                  key={index}
                  onClick={() => setSelectedDayIndex(index)}
                  className={`flex flex-col items-center justify-center rounded-2xl min-w-[70px] p-3 snap-center transition-colors ${isActive ? 'bg-[#F8F9FA] shadow-sm border border-gray-100' : 'hover:bg-[#F8F9FA] cursor-pointer'}`}
                >
                  <p className={`text-sm ${isActive ? 'font-semibold text-[#2C3E50]' : 'font-medium text-[#6C757D]'}`}>{d.dayStr}</p>
                  <span className="my-2.5 text-3xl relative">
                    {d.icon}
                    {hasRain && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-blue-500">💧</span>}
                  </span>
                  <p className="text-sm font-medium text-[#2C3E50] flex gap-1.5">
                    <span>{high}°</span>
                    <span className="text-[#6C757D]">{low}°</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
