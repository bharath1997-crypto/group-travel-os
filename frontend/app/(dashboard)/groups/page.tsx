"use client";

import Link from "next/link";
import { OpenLoungeButton } from "@/components/lounge/OpenLoungeButton";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function GroupsPage() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-[#F8FAFC] px-6 py-12 text-slate-800">
      <div className="w-full max-w-md text-center">
        {/* Rovvy Logo */}
        <div className="mb-8 flex justify-center">
          <RovvyLogo variant="primary" size="lg" showTagline={false} />
        </div>

        {/* Decorative Animated Icon */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] shadow-lg shadow-[#0F766E]/20">
          <span className="text-3xl" role="img" aria-label="groups">
            👥
          </span>
          <span className="absolute -right-1 -top-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14B8A6] opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 rounded-full bg-[#0D9488]"></span>
          </span>
        </div>

        {/* Title and Message */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          My Groups
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Your groups will appear here. Create a group to coordinate flights, split expenses, and share itineraries in real-time.
        </p>

        {/* Action Button */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/groups/new"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0F766E]/20 transition-all hover:brightness-110 active:scale-95"
          >
            Create a Group
          </Link>
          <OpenLoungeButton className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900">
            Open Rovvy Lounge
          </OpenLoungeButton>
        </div>

        {/* Quick Help/Feature Info cards */}
        <div className="mt-12 text-left border-t border-slate-200 pt-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
            With Rovvy Groups you can:
          </h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-base" role="img" aria-label="itinerary">✈️</span>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Share itineraries</h4>
                <p className="text-xs text-slate-500">All members can view plans and flight statuses.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base" role="img" aria-label="wallet">💵</span>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Split bills</h4>
                <p className="text-xs text-slate-500">No more complex spreadsheets. Split travel costs instantly.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
