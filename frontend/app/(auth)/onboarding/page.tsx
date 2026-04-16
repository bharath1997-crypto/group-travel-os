"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "travello_onboarded";

const slides = [
  {
    gradient: "linear-gradient(135deg, #FF6B35, #FF8E53)",
    heading: "Plan trips together",
    subtext:
      "Create groups, add friends, and plan your perfect trip with everyone in one place",
    features: ["Trip maps", "Group polls", "Split bills"] as const,
  },
  {
    gradient: "linear-gradient(135deg, #667eea, #764ba2)",
    heading: "See everyone live on the map",
    subtext:
      "Real-time location sharing, meeting points, and countdown timers for your group",
    features: ["Live location", "Timers", "Alerts"] as const,
  },
  {
    gradient: "linear-gradient(135deg, #11998e, #38ef7d)",
    heading: "Split expenses easily",
    subtext:
      "Scan receipts, track who paid what, and settle up with one tap after the trip",
    features: ["Scan receipt", "Auto split", "Settle up"] as const,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      router.replace("/login");
    }
  }, [router]);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    router.replace("/register");
  }, [router]);

  const goNext = useCallback(() => {
    if (index < slides.length - 1) {
      setIndex((i) => i + 1);
    } else {
      finish();
    }
  }, [index, finish]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (dx < -48 && index < slides.length - 1) setIndex((i) => i + 1);
    else if (dx > 48 && index > 0) setIndex((i) => i - 1);
  };

  return (
    <div className="relative flex h-svh max-h-[100dvh] flex-col overflow-hidden">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}vw)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, i) => (
          <section
            key={slide.heading}
            className="flex h-svh min-h-0 w-screen shrink-0 flex-col px-5 pb-8 pt-14 text-white"
            style={{ background: slide.gradient }}
            aria-hidden={i !== index}
          >
            <div className="relative flex min-h-0 flex-1 flex-col">
              {i < 2 ? (
                <button
                  type="button"
                  onClick={finish}
                  className="absolute right-0 top-0 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
                >
                  Skip
                </button>
              ) : (
                <span className="absolute right-0 top-0 h-5 w-12" aria-hidden />
              )}

              {i === 0 ? (
                <div className="mb-6 flex justify-center">
                  <Image
                    src="/logo-light.svg"
                    alt="Travello"
                    width={200}
                    height={48}
                    className="h-12 w-auto drop-shadow-md"
                    priority
                  />
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {slide.heading}
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/95 sm:text-base">
                  {slide.subtext}
                </p>

                <div className="mt-8 flex w-full max-w-md flex-wrap justify-center gap-2 sm:gap-3">
                  {slide.features.map((f) => (
                    <span
                      key={f}
                      className="rounded-2xl border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-sm sm:text-sm"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <div className="flex gap-2" role="tablist" aria-label="Slide">
                  {slides.map((_, di) => (
                    <button
                      key={di}
                      type="button"
                      role="tab"
                      aria-selected={di === index}
                      onClick={() => setIndex(di)}
                      className={`h-2.5 rounded-full transition-all ${
                        di === index ? "w-8 bg-white" : "w-2.5 bg-white/45"
                      }`}
                    />
                  ))}
                </div>

                {i === slides.length - 1 ? (
                  <button
                    type="button"
                    onClick={finish}
                    className="min-h-[48px] min-w-[160px] rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#11998e] shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Create Account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="min-h-[48px] rounded-2xl bg-white/20 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/30"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="sr-only">
        Already onboarded?{" "}
        <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
