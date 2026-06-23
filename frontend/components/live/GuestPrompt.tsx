"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type GuestPromptProps = {
  message: string;
  onDismiss: () => void;
};

export function GuestPrompt({ message, onDismiss }: GuestPromptProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900">{message}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onDismiss}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0d655c]"
          >
            Create free account
          </button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl px-4 py-2 text-sm font-medium text-stone-500 transition hover:text-stone-700"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}
