"use client";

import { useEffect, useState } from "react";
import { ExplorerHorizontalRail } from "@/components/explorer/ExplorerHorizontalRail";
import { apiFetch } from "@/lib/api";

type ExplorerCard = {
  id: string;
  type: string;
  source: string;
  title: string;
  venue_name?: string;
  city_name?: string;
  module?: string;
  links?: Record<string, string>;
  images?: string[];
  metadata?: Record<string, any>;
};

type ExplorerFeedViewProps = {
  lat: number;
  lon: number;
  radius?: number;
};

export function ExplorerFeedView({ lat, lon, radius = 10000 }: ExplorerFeedViewProps) {
  const [cards, setCards] = useState<ExplorerCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeed() {
      setLoading(true);
      try {
        // Calling the new unified backend endpoint
        const data = await apiFetch<ExplorerCard[]>(
          `/explorer/feed?lat=${lat}&lon=${lon}&radius=${radius}`
        );
        setCards(data);
      } catch (error) {
        console.error("Failed to fetch feed:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFeed();
  }, [lat, lon, radius]);

  if (loading) {
    return (
      <div className="text-white p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Generating live feed...</span>
      </div>
    );
  }

  // Group cards by module to enforce the "One-Row Rule"
  const groupedCards = cards.reduce((acc, card) => {
    const moduleName = card.module || "other";
    if (!acc[moduleName]) acc[moduleName] = [];
    acc[moduleName].push(card);
    return acc;
  }, {} as Record<string, ExplorerCard[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedCards).map(([moduleName, moduleCards]) => (
        <ExplorerHorizontalRail
          key={moduleName}
          title={moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}
          subtitle={`Live updates from ${moduleCards[0]?.source || "Explorer"}`}
        >
          {moduleCards.map((card) => (
            <div key={card.id} className="min-w-[280px] max-w-[280px] h-full">
              <div className="bg-[#0d1f33] border border-[#1E293B]/40 rounded-xl p-4 h-full flex flex-col justify-between hover:border-primary/30 transition-all">
                <div>
                  {card.images?.[0] && (
                    <div className="relative h-36 w-full mb-3 rounded-lg overflow-hidden">
                      <img 
                        src={card.images[0]} 
                        alt={card.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">{card.title}</h3>
                  {card.venue_name && (
                    <p className="text-gray-400 text-xs truncate">{card.venue_name}</p>
                  )}
                </div>
                
                <div className="mt-4 flex justify-between items-center pt-3 border-t border-[#1E293B]/20">
                  <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                    {card.type}
                  </span>
                  
                  {/* Action buttons based on card type */}
                  <div className="flex gap-2">
                    {card.links?.article && (
                      <a
                        href={card.links.article}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Read
                      </a>
                    )}
                    {card.links?.stream && (
                      <a
                        href={card.links.stream}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Listen
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </ExplorerHorizontalRail>
      ))}
    </div>
  );
}
