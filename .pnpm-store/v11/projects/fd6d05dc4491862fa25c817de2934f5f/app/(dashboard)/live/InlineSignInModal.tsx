"use client";

import { useState, type FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, X } from "lucide-react";
import { apiFetchWithStatus } from "@/lib/safe-fetch";
import { saveToken } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { RovvyLogo } from "@/components/RovvyLogo";

interface InlineSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LoginResponse = {
  user: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
    email_verified?: boolean;
    is_verified?: boolean;
  };
  token: { access_token: string; token_type: string; expires_in: number };
};

export default function InlineSignInModal({ isOpen, onClose }: InlineSignInModalProps) {
  const { refreshUser } = useDashboardUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, status } = await apiFetchWithStatus<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        },
        30000,
      );

      if (status !== 200 || !data) {
        setError("Invalid email or password");
        return;
      }

      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem("gt_user_name", data.user.full_name.trim() || "Traveler");
        syncLocalProfileCache(data.user);
      }

      // Refresh the context user state so page immediately updates to authenticated state
      await refreshUser();
      onClose();
    } catch (err) {
      setError("Unable to sign in. Please verify your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.15)] border border-stone-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <RovvyLogo variant="primary" size="md" />
          <h2 id="modal-title" className="mt-4 text-base font-bold text-stone-800">
            Sign in to start
          </h2>
          <p className="mt-1 text-xs text-stone-500 leading-snug">
            Save routes, track GPS location, and stay in sync with your group.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inline-email" className="text-xs font-semibold text-stone-600">
              Email address
            </label>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 shadow-sm transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/15">
              <Mail className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                id="inline-email"
                type="email"
                placeholder="you@email.com"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-[13px] text-stone-800 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inline-password" className="text-xs font-semibold text-stone-600">
              Password
            </label>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 shadow-sm transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/15">
              <Lock className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                id="inline-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-[13px] text-stone-800 outline-none placeholder:text-stone-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-center font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
