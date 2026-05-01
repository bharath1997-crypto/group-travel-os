"use client";

import { useEffect } from "react";

type TravelloLogoProps = {
  variant?: "full" | "mark" | "pill" | "pill-dark";
  size?: "sm" | "md" | "lg";
  animated?: boolean;
};

const NAVY = "#1C2B3A";
const PINK = "#E8619A";
const WHITE = "#FFFFFF";

const WORD_SIZE = {
  sm: 18,
  md: 28,
  lg: 36,
} as const;

const SCALE = {
  sm: 0.72,
  md: 1,
  lg: 1.22,
} as const;

function useTravelloLogoStyles() {
  useEffect(() => {
    if (document.getElementById("travello-logo-styles")) return;

    const s = document.createElement("style");
    s.id = "travello-logo-styles";
    s.textContent = `
@keyframes travello-logo-bob {
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-8px)}
}
@keyframes travello-logo-sweep {
  0%{transform:scaleX(0);opacity:0}
  20%{opacity:1}
  80%{opacity:1}
  100%{transform:scaleX(1);opacity:0}
}
.travello-logo-bob {
  animation: travello-logo-bob 1.4s ease-in-out infinite;
}
.travello-logo-sweep {
  animation: travello-logo-sweep 1.8s ease-in-out infinite;
}
`;
    document.head.appendChild(s);
  }, []);
}

function Figure({
  color,
  bodyHeight,
  opacity = 1,
  delay = "0s",
  animated,
}: {
  color: string;
  bodyHeight: number;
  opacity?: number;
  delay?: string;
  animated: boolean;
}) {
  return (
    <span
      className={animated ? "travello-logo-bob" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        opacity,
        animationDelay: delay,
      }}
      aria-hidden
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          background: color,
        }}
      />
      <span
        style={{
          width: 7,
          height: bodyHeight,
          borderRadius: 3,
          background: color,
        }}
      />
    </span>
  );
}

function Figures({
  variant,
  animated,
}: {
  variant: NonNullable<TravelloLogoProps["variant"]>;
  animated: boolean;
}) {
  const pill = variant === "pill";
  const mark = variant === "mark";
  const full = variant === "full";
  const secondColor = pill ? WHITE : PINK;

  return (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <Figure color={WHITE} bodyHeight={18} animated={animated} />
        <Figure
          color={secondColor}
          bodyHeight={22}
          delay="0.2s"
          animated={animated}
        />
        {full ? (
          <Figure
            color={WHITE}
            bodyHeight={14}
            opacity={0.4}
            delay="0.4s"
            animated={animated}
          />
        ) : null}
      </span>
      {full ? (
        <span
          style={{
            position: "relative",
            display: "block",
            width: 60,
            height: 2,
            overflow: "hidden",
            borderRadius: 2,
            background: "rgba(255,255,255,0.1)",
            transformOrigin: "left center",
          }}
          aria-hidden
        >
          <span
            className={animated ? "travello-logo-sweep" : undefined}
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              width: "100%",
              height: "100%",
              background: PINK,
              borderRadius: 2,
              transformOrigin: "left center",
            }}
          />
        </span>
      ) : null}
    </span>
  );
}

function Wordmark({
  color,
  size,
  splitPink,
}: {
  color: string;
  size: "sm" | "md" | "lg";
  splitPink: boolean;
}) {
  return (
    <span
      style={{
        color,
        fontSize: WORD_SIZE[size],
        fontWeight: 500,
        letterSpacing: 1,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      travel
      <span style={{ color: splitPink ? PINK : color }}>lo</span>
    </span>
  );
}

export function TravelloLogo({
  variant = "full",
  size = "md",
  animated = true,
}: TravelloLogoProps) {
  useTravelloLogoStyles();

  const scale = SCALE[size];
  const isPill = variant === "pill" || variant === "pill-dark";
  const isMark = variant === "mark";
  const wordColor = variant === "full" || variant === "pill" || variant === "pill-dark" ? WHITE : NAVY;

  const content = (
    <>
      <span style={{ transform: `scale(${scale})`, transformOrigin: "left bottom" }}>
        <Figures variant={variant} animated={animated} />
      </span>
      {!isMark ? (
        <Wordmark
          color={wordColor}
          size={size}
          splitPink={variant === "full"}
        />
      ) : null}
    </>
  );

  if (variant === "pill") {
    return (
      <span
        aria-label="Travello"
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 10,
          padding: "6px 14px",
          borderRadius: 20,
          background: PINK,
        }}
      >
        {content}
      </span>
    );
  }

  if (variant === "pill-dark") {
    return (
      <span
        aria-label="Travello"
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 10,
          padding: "6px 14px",
          borderRadius: 20,
          background: NAVY,
          border: `1.5px solid ${PINK}`,
        }}
      >
        {content}
      </span>
    );
  }

  return (
    <span
      aria-label="Travello"
      style={{
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: isMark ? 0 : 14,
      }}
    >
      {content}
    </span>
  );
}

export default TravelloLogo;
