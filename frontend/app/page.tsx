"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import TravelloLogo from "@/components/TravelloLogo";
import { getToken } from "@/lib/auth";

const ONBOARD_KEY = "travello_onboarded";
const SPLASH_MS = 1500;

const AVATAR_SEEDS = ["a", "b", "c", "d", "e"] as const;

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<"splash" | "go">("splash");

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("go"), SPLASH_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "go") return;
    const token = getToken();
    if (token) {
      router.replace("/dashboard");
      return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(ONBOARD_KEY) !== "true") {
      router.replace("/onboarding");
      return;
    }
    router.replace("/login");
  }, [phase, router]);

  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background: "linear-gradient(135deg, #E94560, #FF6B6B, #FF6B9D)",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes travello-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.06); opacity: 0.92; }
}
.travello-logo-pulse {
  animation: travello-pulse 1.8s ease-in-out infinite;
}
`,
        }}
      />

      <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
        <div className="travello-logo-pulse">
          <TravelloLogo variant="full" size="lg" animated />
        </div>
        <p className="mt-6 text-lg font-semibold text-white drop-shadow-sm sm:text-xl">
          Group Travel. Simplified.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2">
          {AVATAR_SEEDS.map((seed, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- DiceBear remote avatars
            <img
              key={seed}
              src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border-2 border-white/40 shadow-md"
              style={{
                marginLeft: i > 0 ? -6 : 0,
                zIndex: 5 - i,
              }}
            />
          ))}
        </div>

        <p className="mt-6 text-sm font-medium text-white/90">Join 50,000+ travelers</p>
      </div>
    </div>
  );
}
