"use client";

import type { CSSProperties, ReactNode } from "react";
import { getCategoryGradient } from "@/lib/explore-category-gradient";

type ExploreCardImageProps = {
  imageUrl?: string | null;
  alt: string;
  category?: string;
  className?: string;
  imgClassName?: string;
  overlay?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
};

export function ExploreCardImage({
  imageUrl,
  alt,
  category,
  className = "relative aspect-[4/3] overflow-hidden bg-slate-100",
  imgClassName = "h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]",
  overlay = false,
  style,
  children,
}: ExploreCardImageProps) {
  const gradient = getCategoryGradient(category);

  return (
    <div
      className={className}
      style={{
        ...style,
        ...(!imageUrl ? { background: gradient } : undefined),
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          className={imgClassName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const parent = e.currentTarget.parentElement;
            if (parent) parent.style.background = gradient;
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", background: gradient }} />
      )}
      {overlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
