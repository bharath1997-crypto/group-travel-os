"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RovvyLogo } from "@/components/RovvyLogo";
import { apiFetch } from "@/lib/api";

export default function CheckEmailPage() {
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("pending_verification_email");
    if (saved) {
      setEmail(saved);
    }
  }, []);

  async function handleResend() {
    if (!email) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage("Verification email sent! Please check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to resend email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 py-10">
      <div className="mb-8">
        <RovvyLogo variant="dark" size="lg" showTagline={false} />
      </div>
      
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl bg-[#1E293B] p-8 shadow-xl">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <span className="text-4xl" aria-hidden>✉️</span>
        </div>
        
        <h1 className="text-center text-2xl font-bold text-white">
          Check your email
        </h1>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-muted">
          We sent a verification link to your email address
          {email ? <><br /><span className="font-medium text-[#F8FAFC]">{email}</span></> : "."}
        </p>

        {message && (
          <div className="mt-4 rounded-lg bg-primary/20 px-4 py-3 text-sm text-[#2DD4BF]">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mt-4 rounded-lg bg-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={busy || !email}
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0D6B63] disabled:opacity-50"
        >
          {busy ? "Sending..." : "Resend email"}
        </button>

        <div className="mt-6">
          <Link
            href="/register"
            className="text-sm font-medium text-[#2DD4BF] hover:underline"
          >
            Wrong email? Sign up again
          </Link>
        </div>
      </div>
    </div>
  );
}
