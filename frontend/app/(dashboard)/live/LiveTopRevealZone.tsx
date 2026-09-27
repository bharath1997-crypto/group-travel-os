"use client";

type LiveTopRevealZoneProps = {
  visible: boolean;
  onReveal: () => void;
};

/** Invisible top-edge hit target — pull header down like Android / Windows immersive apps. */
export default function LiveTopRevealZone({ visible, onReveal }: LiveTopRevealZoneProps) {
  if (!visible) return null;

  return (
    <div
      className="live-top-reveal-zone pointer-events-auto fixed inset-x-0 top-0 z-[39] h-7 touch-manipulation md:h-8"
      onPointerEnter={onReveal}
      onFocus={onReveal}
      aria-hidden
    />
  );
}
