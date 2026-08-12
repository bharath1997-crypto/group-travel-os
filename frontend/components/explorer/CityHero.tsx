"use client";

import { useEffect, useState } from "react";

import { getWeatherHeroSnapshot } from "@/components/explorer/WeatherWidget";

export type HeroPhotoPayload = {
  url: string;
  photographer_name?: string;
  photographer_username?: string;
  photographer_link?: string;
  unsplash_photo_link?: string;
} | null;

type CityHeroProps = {
  displayName: string;
  photo: HeroPhotoPayload;
  /** True while hero-photo API request is in flight */
  photoLoading: boolean;
  onWeatherPillClick?: () => void;
  realWeather?: {
    temp: number;
    wind: number;
    icon: string;
  } | null;
};

export function CityHero({
  displayName,
  photo,
  photoLoading,
  onWeatherPillClick,
  realWeather,
}: CityHeroProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [heroSnapshot] = useState(() => getWeatherHeroSnapshot());

  useEffect(() => {
    setImgLoaded(false);
  }, [photo?.url]);

  const url = photo?.url ?? null;
  const showSkeleton = photoLoading || (Boolean(url) && !imgLoaded);
  const showGradient = !photoLoading && !url;

  return (
    <section className="relative w-full overflow-hidden border-b border-[#1E293B]">
      <div className="relative aspect-[21/9] min-h-[200px] w-full max-h-[420px] sm:min-h-[240px] md:aspect-[2.4/1]">
        {showSkeleton ? (
          <div
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E293B]"
            aria-hidden
          />
        ) : null}

        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
          />
        ) : null}

        {showGradient ? (
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-primary/40"
            aria-hidden
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-[#1E3A5F] via-[#1E3A5F]/55 to-black/25" />

        <div className="absolute inset-0 flex flex-col justify-end px-5 pb-8 pt-16 sm:px-8 sm:pb-10">
          <h1 className="max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl">
            {displayName}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onWeatherPillClick}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/45 hover:bg-black/45"
            >
              <span className="text-lg" aria-hidden>
                {realWeather?.icon || heroSnapshot.icon}
              </span>
              <span>
                {realWeather ? `${realWeather.temp.toFixed(0)}°C` : `${heroSnapshot.tempF}°F`}
                {realWeather ? ` · Wind ${realWeather.wind} km/h` : ` · ${heroSnapshot.condition}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {photo &&
      (photo.photographer_name ||
        photo.photographer_username ||
        photo.unsplash_photo_link) ? (
        <p className="bg-[#1E293B] px-5 py-2 text-center text-[11px] text-gray-400 sm:px-8">
          Photo by{" "}
          {photo.photographer_link ? (
            <a
              href={photo.photographer_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {photo.photographer_name || `@${photo.photographer_username}`}
            </a>
          ) : (
            <span className="text-gray-300">
              {photo.photographer_name || photo.photographer_username}
            </span>
          )}{" "}
          on{" "}
          {photo.unsplash_photo_link ? (
            <a
              href={photo.unsplash_photo_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Unsplash
            </a>
          ) : (
            <span>Unsplash</span>
          )}
        </p>
      ) : null}
    </section>
  );
}
