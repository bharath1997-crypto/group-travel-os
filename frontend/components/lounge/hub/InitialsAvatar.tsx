import { listAvatarColor } from "@/lib/lounge/hub-utils";

export function InitialsAvatar({
  name,
  size,
  className = "",
}: {
  name: string;
  size: 32 | 40 | 46 | 80 | 120;
  className?: string;
}) {
  const label = (name.trim() || "?").toUpperCase();
  const letter = label.charAt(0) || "?";
  const bg = listAvatarColor(name.trim() || "?");
  const textClass =
    size === 32
      ? "text-sm"
      : size === 40
        ? "text-base"
        : size === 46
          ? "text-lg"
          : size === 80
            ? "text-2xl"
            : size === 120
              ? "text-3xl"
              : "text-3xl";
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${textClass} ${className}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: bg,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
