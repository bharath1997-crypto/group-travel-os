import type { InputHTMLAttributes, ReactNode } from "react";

type AuthInputProps = {
  icon: ReactNode;
  placeholder: string;
  error?: string;
  /** e.g. password visibility toggle */
  endAdornment?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function AuthInput({
  icon,
  placeholder,
  error,
  endAdornment,
  id,
  ...rest
}: AuthInputProps) {
  const padRight = endAdornment ? "pr-12" : "pr-3";
  return (
    <div className="w-full">
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted"
          aria-hidden
        >
          {icon}
        </span>
        <input
          id={id}
          placeholder={placeholder}
          className={`w-full rounded-2xl border border-[#334155] bg-[#1E293B] py-3 pl-11 ${padRight} text-sm text-white shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[#0F766E]/20 disabled:cursor-not-allowed disabled:bg-[#1E293B]/50 disabled:opacity-70`}
          {...rest}
        />
        {endAdornment ? (
          <div className="absolute right-2 top-1/2 z-[1] -translate-y-1/2">{endAdornment}</div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
