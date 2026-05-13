import Image from "next/image";

export function TravelloLogo({
  variant = "dark",
  width = 120,
  height = 40,
}: {
  variant?: "dark" | "primary";
  width?: number;
  height?: number;
}) {
  return (
    <Image
      src={
        variant === "dark" ? "/logo-dark.png" : "/logo-primary.png"
      }
      alt="Rovvy"
      width={width}
      height={height}
      priority
    />
  );
}

export function TravelloIcon({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo-icon.png"
      alt="Rovvy"
      width={size}
      height={size}
      priority
    />
  );
}

export default TravelloLogo;
