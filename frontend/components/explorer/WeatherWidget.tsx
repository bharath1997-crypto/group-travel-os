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

export const MOCK_DAYS: DailyData[] = [
  { dayStr: "Tue", dateStr: "May 5", icon: "☁️", condition: "Cloudy", highF: 55, lowF: 45, highC: 13, lowC: 7, precipProb: 25, humidity: 43, windSpeed: 8, hourly: generateHourly(50) },
  { dayStr: "Wed", dateStr: "May 6", icon: "☁️", condition: "Mostly Cloudy", highF: 54, lowF: 42, highC: 12, lowC: 6, precipProb: 10, humidity: 50, windSpeed: 10, hourly: generateHourly(48) },
  { dayStr: "Thu", dateStr: "May 7", icon: "🌧️", condition: "Rain Showers", highF: 57, lowF: 44, highC: 14, lowC: 7, precipProb: 80, humidity: 75, windSpeed: 14, hourly: generateHourly(51) },
  { dayStr: "Fri", dateStr: "May 8", icon: "🌧️", condition: "Heavy Rain", highF: 63, lowF: 52, highC: 17, lowC: 11, precipProb: 95, humidity: 85, windSpeed: 18, hourly: generateHourly(58) },
  { dayStr: "Sat", dateStr: "May 9", icon: "🌧️", condition: "Scattered Showers", highF: 75, lowF: 51, highC: 24, lowC: 11, precipProb: 60, humidity: 65, windSpeed: 12, hourly: generateHourly(63) },
  { dayStr: "Sun", dateStr: "May 10", icon: "⛅", condition: "Partly Sunny", highF: 58, lowF: 48, highC: 14, lowC: 9, precipProb: 5, humidity: 40, windSpeed: 9, hourly: generateHourly(53) },
  { dayStr: "Mon", dateStr: "May 11", icon: "⛅", condition: "Partly Sunny", highF: 58, lowF: 51, highC: 14, lowC: 11, precipProb: 10, humidity: 45, windSpeed: 7, hourly: generateHourly(54) },
  { dayStr: "Tue", dateStr: "May 12", icon: "🌧️", condition: "Rain", highF: 73, lowF: 53, highC: 23, lowC: 12, precipProb: 70, humidity: 70, windSpeed: 15, hourly: generateHourly(63) },
];

/** Same mock “today” logic as the modal — for compact hero pills tied to WeatherWidget data */
export function getWeatherHeroSnapshot(): {
  tempF: number;
  icon: string;
  condition: string;
} {
  const currentDay = MOCK_DAYS[0]!;
  const currentHourIdx = new Date().getHours();
  const currentHourData =
    currentDay.hourly[currentHourIdx] || currentDay.hourly[12]!;
  return {
    tempF: currentHourData.tempF,
    icon: currentDay.icon,
    condition: currentDay.condition,
  };
}

export function WeatherWidget({
  isOpen,
  onClose,
  city: initialCity,
  onLocationEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  city: string;
  onLocationEdit?: () => void;
}) {
  const [unit, setUnit] = useState<"F" | "C">("F");
  const [activeTab, setActiveTab] = useState<"Temperature" | "Precipitation" | "Wind">("Temperature");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNight, setIsNight] = useState(false);
  const [currentCity, setCurrentCity] = useState(initialCity);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [weatherData, setWeatherData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState({ lat: 41.8781, lon: -87.6298 });
  const [utcOffset, setUtcOffset] = useState(0);
  const [timezoneName, setTimezoneName] = useState("");
  const [cityLocalTime, setCityLocalTime] = useState<Date>(new Date());
  
  // Locations List State
  const [effectiveLocations, setEffectiveLocations] = useState<any[]>([]);

  const isPinOrPostalQuery = (q: string) => /^\d{5,6}$/.test(q.trim());

  useEffect(() => {
    setCurrentCity(initialCity);
  }, [initialCity, isOpen]);

  // City Local Time Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const cityTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (utcOffset * 1000));
      setCityLocalTime(cityTime);
      
      const hour = cityTime.getHours();
      setIsNight(hour < 6 || hour >= 19);
    }, 1000);
    return () => clearInterval(timer);
  }, [utcOffset]);

  // Dynamic Fetching Logic
  useEffect(() => {
    if (!isOpen || !currentCity) return;

    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        // 1. Resolve Coordinates (Fetch up to 5 matches for pin codes)
        const isZip = /^\d{5,6}$/.test(currentCity.trim());
        const searchUrl = isZip 
          ? `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(currentCity.trim())}&limit=5&addressdetails=1`
          : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(currentCity)}&limit=1&addressdetails=1`;

        const geoRes = await fetch(searchUrl, { signal: ac.signal });
        const geoData = await geoRes.json();

        if (geoData?.length > 1 && isZip) {
          setEffectiveLocations(geoData);
        } else {
          setEffectiveLocations([]);
        }

        if (geoData?.[0]) {
          const firstMatch = geoData[0];
          const lat = parseFloat(firstMatch.lat);
          const lon = parseFloat(firstMatch.lon);
          setCoords({ lat, lon });

          // 2. Fetch Live Weather
          const res = await fetch(
            `http://localhost:8000/api/v1/explore/weather?city=${encodeURIComponent(currentCity)}&lat=${lat}&lon=${lon}`,
            { signal: ac.signal }
          );
          const data = await res.json();
          
          if (data?.weather) {
            setUtcOffset(data.weather.utc_offset_seconds || 0);
            setTimezoneName(data.weather.timezone || "");
            const baseTempF = Math.round((data.weather.current_weather.temperature * 9/5) + 32);

            let hourlyData: HourlyData[] = [];
            if (data.weather.hourly?.temperature_2m) {
               const times = ["12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM"];
               hourlyData = data.weather.hourly.temperature_2m.slice(0, 24).map((t: number, i: number) => ({
                time: times[i],
                tempC: Math.round(t),
                tempF: Math.round((t * 9/5) + 32),
                precip: Math.floor(Math.random() * 5),
                wind: Math.round(data.weather.current_weather.windspeed)
              }));
            } else {
              hourlyData = generateHourly(baseTempF);
            }

            const liveData: DailyData[] = [
              {
                dayStr: new Date().toLocaleDateString('en-US', { weekday: 'short' }),
                dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                icon: data.weather.current_weather.weathercode <= 3 ? "☀️" : "☁️",
                condition: data.weather.current_weather.weathercode <= 3 ? "Clear" : "Cloudy",
                highF: Math.round(baseTempF + 3),
                lowF: Math.round(baseTempF - 7),
                highC: Math.round(((baseTempF + 3) - 32) * 5/9),
                lowC: Math.round(((baseTempF - 7) - 32) * 5/9),
                precipProb: 0,
                humidity: data.weather.current_weather.relative_humidity_2m || 45,
                windSpeed: Math.round(data.weather.current_weather.windspeed * 0.621371),
                hourly: hourlyData
              },
              ...MOCK_DAYS.slice(1).map(d => ({ ...d, highF: Math.round(baseTempF + (Math.random() * 5)), lowF: Math.round(baseTempF - 10), highC: Math.round(((baseTempF + 5) - 32) * 5/9), lowC: Math.round(((baseTempF - 10) - 32) * 5/9) }))
            ];
            setWeatherData(liveData);
          }
        }
      } catch (err) {
        console.error("Failed to fetch weather", err);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [currentCity, isOpen]);

  // Auto-scroll to the current hour when opened
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const cityHour = cityLocalTime.getHours();
      scrollRef.current.scrollLeft = Math.max(0, (cityHour - 2) * 60);
    }
  }, [isOpen, loading]);

  if (!isOpen) return null;

  const activeData = weatherData.length > 0 ? weatherData : MOCK_DAYS;
  const currentDay = activeData[selectedDayIndex] || activeData[0];
  const isToday = selectedDayIndex === 0;
  
  // Use city local time for "today" index
  const cityHourIdx = cityLocalTime.getHours();
  const currentHourIdx = isToday ? cityHourIdx : 12;
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

  const hasRain = currentDay.icon.includes("🌧️") || currentDay.condition.toLowerCase().includes("rain");
  const hasSnow = currentDay.icon.includes("❄️") || currentDay.condition.toLowerCase().includes("snow");
  const isSunny = currentDay.icon.includes("☀️") || currentDay.condition.toLowerCase().includes("sunny") || currentDay.condition.toLowerCase().includes("clear");

  const showCoordinateSubtitle = !isPinOrPostalQuery(currentCity);
  const brandingFirstWord = (() => {
    if (isPinOrPostalQuery(currentCity)) return "Regional";
    return currentCity.split(" ")[0] || "Travel";
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-2xl relative border transition-colors duration-700 ${isNight ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-gray-100 text-[#2C3E50]'}`}>
        
        {/* Weather Effects Layer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          {hasRain && Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rain-drop" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.5 + Math.random()}s` }} />
          ))}
          {hasSnow && Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="snowflake" style={{ left: `${Math.random() * 100}%`, fontSize: `${10 + Math.random() * 15}px`, animationDelay: `${Math.random() * 3}s` }}>❄</div>
          ))}
          {isNight && (
            <div className="absolute top-10 right-20 text-4xl opacity-20 moon-float">🌙</div>
          )}
        </div>

        {/* Branding Background */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden opacity-[0.03]">
          <span className="text-[12rem] font-black uppercase italic tracking-tighter">
            {brandingFirstWord} Pulse
          </span>
        </div>

        <button
          onClick={onClose}
          className={`absolute right-6 top-6 transition-colors z-20 p-2 rounded-full ${isNight ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="p-8 relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex gap-6 items-center">
              <div className="relative">
                 <span className={`text-8xl drop-shadow-2xl filter ${isSunny ? 'sun-cycle-glow' : ''}`}>{currentDay.icon}</span>
                 {hasRain && <span className="absolute -bottom-2 right-0 text-3xl animate-bounce">💧</span>}
              </div>
              <div className="flex items-start">
                <span className="text-7xl font-bold tracking-tighter">{mainTemp}</span>
                <div className={`mt-2 ml-1 text-base font-bold flex gap-1 ${isNight ? 'text-white/60' : 'text-[#6C757D]'}`}>
                  <button onClick={() => setUnit("F")} className={`transition-colors ${unit === "F" ? (isNight ? 'text-white' : 'text-[#2C3E50]') : 'hover:opacity-80'}`}>°F</button>
                  <span className="opacity-30">|</span>
                  <button onClick={() => setUnit("C")} className={`transition-colors ${unit === "C" ? (isNight ? 'text-white' : 'text-[#2C3E50]') : 'hover:opacity-80'}`}>°C</button>
                </div>
              </div>
              <div className={`ml-4 flex flex-col justify-center text-xs space-y-1 ${isNight ? 'text-white/60' : 'text-[#6C757D]'}`}>
                <p>Precipitation: <span className={`font-bold ${isNight ? 'text-white' : 'text-[#2C3E50]'}`}>{currentDay.precipProb}%</span></p>
                <p>Humidity: <span className={`font-bold ${isNight ? 'text-white' : 'text-[#2C3E50]'}`}>{currentDay.humidity}%</span></p>
                <p>Wind: <span className={`font-bold ${isNight ? 'text-white' : 'text-[#2C3E50]'}`}>{currentDay.windSpeed} mph</span></p>
              </div>
            </div>
            
            <div className="md:text-right">
              <div className="inline-flex items-center gap-2 mb-1">
                <div className={`h-2 w-2 rounded-full animate-pulse ${isNight ? 'bg-blue-400' : 'bg-[#E94560]'}`} />
                <h3 className="text-3xl font-black tracking-tight italic uppercase">Weather</h3>
              </div>
              <p className={`text-xl font-bold tracking-tighter ${isNight ? 'text-white' : 'text-[#2C3E50]'}`}>
                {cityLocalTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                <span className="ml-2 text-[10px] font-medium opacity-40 uppercase tracking-widest">{timezoneName.split('/').pop()?.replace('_', ' ')}</span>
              </p>
              <p className={`text-sm font-semibold ${isNight ? 'text-white/60' : 'text-[#6C757D]'}`}>{currentDay.dayStr}, {currentDay.dateStr}</p>
              <p className={`text-sm font-bold uppercase tracking-widest ${isNight ? 'text-blue-400' : 'text-[#E94560]'}`}>{currentDay.condition}</p>
              


              <div className="mt-2 flex flex-wrap items-center md:justify-end gap-2 text-[10px]">
                {isEditingLocation ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (searchQuery.trim()) setCurrentCity(searchQuery.trim());
                          setIsEditingLocation(false);
                          setSearchQuery("");
                        }
                        if (e.key === 'Escape') {
                          setIsEditingLocation(false);
                          setSearchQuery("");
                        }
                      }}
                      placeholder="City or Zip code..."
                      className={`rounded-full px-3 py-1.5 border outline-none font-bold ${isNight ? 'bg-white/10 border-white/20 text-white placeholder:text-white/30' : 'bg-gray-100 border-gray-300 text-[#2C3E50]'}`}
                    />
                    <button 
                      type="button"
                      onClick={() => setIsEditingLocation(false)}
                      className={`p-1.5 rounded-full ${isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-200 hover:bg-gray-300'}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingLocation(true);
                      setSearchQuery("");
                    }}
                    title="Click to check another city's weather"
                    className="flex items-center gap-1.5 transition-all active:scale-95 group/loc outline-none"
                  >
                    {/* Visual city chip (pure HTML, no nested button) */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#E94560]/75 bg-[#162d4a] px-2.5 py-0.5 text-xs font-semibold text-[#E94560] shadow-sm ring-1 ring-[#1e4976]/80 group-hover/loc:border-[#E94560]">
                      <svg className="h-3 w-3 shrink-0 text-[#E94560]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{currentCity}</span>
                    </span>
                    {showCoordinateSubtitle ? (
                    <span className={`rounded-full px-2 py-0.5 border border-transparent group-hover/loc:border-[#E94560]/30 transition-colors ${isNight ? 'bg-white/5 text-white/40' : 'bg-gray-100 text-[#6C757D]'}`}>
                      {currentCity === "Miami" ? "Tropical Pulse" : currentCity === "Guntur" ? "Andhra Pulse" : "Pulse"} ({Math.abs(coords.lat).toFixed(4)}° {coords.lat >= 0 ? 'N' : 'S'}, {Math.abs(coords.lon).toFixed(4)}° {coords.lon >= 0 ? 'E' : 'W'})
                    </span>
                    ) : null}
                  </button>
                )}

                {effectiveLocations.length > 0 && isEditingLocation && (
                  <div className={`absolute top-full mt-2 w-64 z-[60] rounded-2xl border shadow-xl p-3 animate-in fade-in slide-in-from-top-1 ${isNight ? 'bg-[#1E293B] border-white/10' : 'bg-white border-gray-100'}`}>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2 px-1">Effective Locations</p>
                    <div className="space-y-1">
                      {effectiveLocations.map((loc, idx) => {
                        const addr = loc.address;
                        const name = addr?.city || addr?.town || addr?.village || addr?.suburb || addr?.neighbourhood || loc.display_name.split(',')[0];
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setCurrentCity(name);
                              setIsEditingLocation(false);
                              setEffectiveLocations([]);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isNight ? 'hover:bg-white/5 text-white/80' : 'hover:bg-gray-50 text-[#2C3E50]'}`}
                          >
                            {name} <span className="opacity-40 font-normal ml-1">({addr?.state || addr?.country})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-all">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E94560] border-t-transparent" />
                <span className="text-xs font-bold uppercase tracking-widest text-white drop-shadow-md">Updating {currentCity}...</span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className={`mt-10 flex gap-8 border-b text-sm font-bold px-2 ${isNight ? 'border-white/10' : 'border-[#E9ECEF]'}`}>
            {(["Temperature", "Precipitation", "Wind"] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)} 
                className={`pb-4 transition-all relative ${activeTab === tab ? (isNight ? 'text-white' : 'text-[#2C3E50]') : 'text-gray-500 hover:text-gray-300'}`}
              >
                {tab}
                {activeTab === tab && (
                  <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-t-full ${isNight ? 'bg-blue-500' : 'bg-[#FCD34D]'}`} />
                )}
              </button>
            ))}
          </div>



          {/* Weekly Forecast */}
          <div className={`mt-6 border-t pt-6 overflow-x-auto custom-scrollbar snap-x flex justify-between gap-3 px-2 ${isNight ? 'border-white/10' : 'border-[#E9ECEF]'}`}>
            {MOCK_DAYS.map((d, index) => {
              const isActive = index === selectedDayIndex;
              const high = unit === "F" ? d.highF : d.highC;
              const low = unit === "F" ? d.lowF : d.lowC;
              const isRainy = d.icon.includes("🌧️");
              
              return (
                <button 
                  key={index}
                  onClick={() => setSelectedDayIndex(index)}
                  className={`flex flex-col items-center justify-center rounded-[1.5rem] min-w-[75px] p-4 snap-center transition-all duration-300 border ${
                    isActive 
                      ? (isNight ? 'bg-blue-500/20 border-blue-400/30 shadow-blue-900/20' : 'bg-[#F8F9FA] border-gray-200 shadow-lg') 
                      : (isNight ? 'border-transparent hover:bg-white/5' : 'border-transparent hover:bg-[#F8F9FA]')
                  }`}
                >
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isActive ? (isNight ? 'text-blue-400' : 'text-[#2C3E50]') : (isNight ? 'text-white/40' : 'text-gray-500')}`}>{d.dayStr}</p>
                  <span className="my-3 text-4xl relative">
                    {d.icon}
                    {isRainy && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs">💧</span>}
                  </span>
                  <div className="text-xs font-black flex flex-col items-center gap-0.5">
                    <span className={isNight ? 'text-white' : 'text-[#2C3E50]'}>{high}°</span>
                    <span className={isNight ? 'text-white/30' : 'text-[#6C757D]'}>{low}°</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
