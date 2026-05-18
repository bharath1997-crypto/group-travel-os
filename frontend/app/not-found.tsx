"use client";

import Link from "next/link";
import React from "react";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] px-6 py-12 text-[#F8FAFC]">
      <div className="w-full max-w-md text-center">
        {/* Rovvy Logo at top */}
        <div className="mb-12 flex justify-center">
          <RovvyLogo variant="dark" size="lg" showTagline={false} />
        </div>

        {/* Huge "404" text in teal */}
        <div className="relative mb-6">
          <h1 className="text-8xl font-extrabold tracking-widest text-[#0F766E] select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <span className="text-9xl font-black text-white select-none">?</span>
          </div>
        </div>

        {/* Error message */}
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Oops! This page doesn&apos;t exist.
        </h2>
        
        {/* Subtext */}
        <p className="mt-4 text-base text-[#94A3B8]">
          The page you&apos;re looking for has moved or never existed.
        </p>

        {/* Buttons */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0F766E]/20 transition hover:brightness-110 active:scale-95"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-[#334155] bg-[#1E293B]/60 px-6 py-3 text-sm font-semibold text-[#94A3B8] transition hover:bg-[#1E293B] hover:text-white"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
