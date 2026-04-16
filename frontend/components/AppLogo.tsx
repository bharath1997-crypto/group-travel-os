type AppLogoVariant = "onDark" | "onLight";

const SRC: Record<AppLogoVariant, string> = {
  onDark: "/logo-light.svg",
  onLight: "/logo-dark.svg",
};

/**
 * Wordmark from `public/logo-*.svg`.
 * Use `onDark` on dark backgrounds (e.g. sidebar), `onLight` on white cards.
 */
export function AppLogo({
  variant,
  className,
}: {
  variant: AppLogoVariant;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG wordmarks
    <img
      src={SRC[variant]}
      alt="Travello"
      width={200}
      height={48}
      className={className}
      decoding="async"
    />
  );
}
