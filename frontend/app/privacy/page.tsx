"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function PrivacyPage() {
  const [reachedBottom, setReachedBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    // Check if already read
    if (typeof window !== "undefined") {
      const isRead = localStorage.getItem("rovvy_privacy_read") === "true";
      if (isRead) {
        setAccepted(true);
        setReachedBottom(true);
      }
    }
  }, []);

  useEffect(() => {
    if (accepted) return;

    const handleScroll = () => {
      const threshold = 60; // pixels from the bottom
      const totalHeight = document.documentElement.scrollHeight;
      const scrollPosition = window.innerHeight + window.scrollY;
      
      if (scrollPosition >= totalHeight - threshold) {
        setReachedBottom(true);
      }
    };

    const checkInitialHeight = () => {
      const totalHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      // If content is shorter than or equal to the viewport, auto-enable
      if (totalHeight <= viewportHeight + 60) {
        setReachedBottom(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", checkInitialHeight);
    
    // Check initially after render
    const timer = setTimeout(() => {
      handleScroll();
      checkInitialHeight();
    }, 500);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", checkInitialHeight);
      clearTimeout(timer);
    };
  }, [accepted]);

  const handleAccept = () => {
    if (!reachedBottom) return;
    localStorage.setItem("rovvy_privacy_read", "true");
    setAccepted(true);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#E2E8F0] selection:bg-[#0F766E]/40 selection:text-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#1E293B]/80 bg-[#0F172A]/90 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 outline-none">
            <RovvyLogo variant="primary" size="sm" />
          </Link>
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            Data protection
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Last Updated: May 2026 • Version 1.1
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-[#94A3B8] font-normal">
          <p className="text-base text-[#E2E8F0]">
            At <strong className="text-[#CCFBF1]">Rovvy</strong> ("we," "us," or "our"), safeguarding your personal data and respect for your privacy are core commitments. This Privacy Policy describes how we collect, store, share, and protect your information when you use our group travel planning and location-sharing features (the "Service").
          </p>

          <hr className="border-[#1E293B]" />

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">01.</span> Information We Collect
            </h2>
            <p>
              We collect information to deliver features like flight scans, itinerary building, budget calculations, and real-time location sharing. The data we collect includes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Account Info:</strong> Your name, username, email address, password, profile photo, and date of birth.</li>
              <li><strong>OAuth Profiles:</strong> If you register or authenticate using Google or Facebook, we receive authentication credentials and public profile information (such as email address and full name).</li>
              <li><strong>Travel Data:</strong> Itineraries, flight bookings, hotel reservations, routes, buses, and voting logs saved in your collaborative travel hubs.</li>
              <li><strong>Financial Logs:</strong> Budget settings and shared expense splits compiled during trip organization. We never store payment card credentials.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">02.</span> How We Use Your Information
            </h2>
            <p>
              We use your information solely to run and improve the Rovvy ecosystem, including:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Setting up, maintaining, and securing your user account.</li>
              <li>Enabling shared editing of budgets, itineraries, routes, and travel arrangements.</li>
              <li>Sending automated verified notifications, transactional emails, verification links, and welcome summaries.</li>
              <li>Conducting deal scanners to alert your group to flight or hotel discounts.</li>
              <li>Diagnosing technical issues and improving system performance.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">03.</span> Location Data (Live Sharing)
            </h2>
            <p>
              Rovvy offers an optional, active-trip live location sharing feature to help travel groups coordinate live on the ground.
            </p>
            <p className="border-l-2 border-[#0F766E] pl-3 italic text-xs">
              <strong>Crucial Location Privacy Rules:</strong> Live location telemetry is strictly opt-in and is only gathered when you actively activate the "Live Map" feature inside an ongoing trip. We only use this telemetry to plot your location relative to your travel buddies on the shared map. The coordinates are streamed securely, stored ephemerally in a real-time data cache, and are never harvested or sold to third parties. You can deactivate location broadcast instantly at any point from your trip control panel.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">04.</span> Data Sharing and Third Parties
            </h2>
            <p>
              We will never sell or lease your personal information to third parties. We share data only in the following contexts:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Group Buddies:</strong> Travel plans, expenses, user names, and opt-in locations are shared strictly with members of groups you join.</li>
              <li><strong>Service Providers:</strong> We use trusted operational providers such as Supabase (database storage), Firebase RTDB (ephemeral location feeds), and Brevo (transactional email routing). These platforms are legally bound to protect your data.</li>
              <li><strong>Compliance with Law:</strong> We may disclose information if required to do so by a court order or to comply with a valid legal mandate.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">05.</span> Google OAuth Data
            </h2>
            <p>
              When signing in via Google, we access Google profile fields (specifically email and name) strictly to verify your identity and streamline registration. In compliance with Google OAuth API regulations, we never share, license, or sell Google profile records to third-party advertising or analytics networks.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">06.</span> Data Retention
            </h2>
            <p>
              We retain account and group records for as long as your account remains active. Real-time location records are stored in ephemeral Firebase structures and are scrubbed once a trip is completed or you deactivate tracking. If you request account erasure, we will systematically delete or anonymize your personal records within 30 days.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">07.</span> Your Rights
            </h2>
            <p>
              Depending on your location, you may have rights under the GDPR, CCPA, or other data protection laws. These include the right to access the data we hold, correct errors, object to processing, request data portability, or direct us to erase your personal files. You may exercise these rights at any time by contacting our privacy compliance desk.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">08.</span> Security
            </h2>
            <p>
              We apply industry-standard technical measures (such as SSL/TLS session encryption, JWT-based sign-in structures, and restricted database firewalls) to prevent unauthorized access or alteration of your records. However, no transmission system or server can be guaranteed to be 100% immune from malicious breaches.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">09.</span> Children's Privacy
            </h2>
            <p>
              Our Service is not directed to individuals under the age of 13. We do not intentionally compile information from children. If we discover that a user under 13 has supplied us with personal info, we will wipe it from our servers immediately.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">10.</span> Contact Information
            </h2>
            <p>
              For privacy requests, data access directions, or queries regarding how your location telemetry is processed, please contact our compliance desk:
            </p>
            <p className="font-semibold text-[#CCFBF1]">
              Email: privacy@rovvy.app
            </p>
          </section>
        </div>
      </main>

      {/* Floating Scroll Acknowledgment Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1E293B]/80 bg-[#0F172A]/90 backdrop-blur-md p-4 transition-all duration-300">
        <div className="mx-auto flex max-w-xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-xs text-[#94A3B8]">
              {!reachedBottom 
                ? "Please scroll to the bottom of the page to unlock the privacy acknowledgement."
                : accepted 
                  ? "You've successfully acknowledged the Privacy Policy."
                  : "You've read the policy. You can now agree to unlock registration."}
            </p>
          </div>
          
          {accepted ? (
            <div className="flex h-10 items-center gap-2 rounded-lg bg-[#0F766E]/20 px-5 text-sm font-semibold text-[#5EEAD4] border border-[#0F766E]/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Policy Acknowledged
            </div>
          ) : (
            <button
              onClick={handleAccept}
              disabled={!reachedBottom}
              className={`flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all ${
                reachedBottom
                  ? "bg-[#0F766E] text-white hover:bg-[#0D6B63] cursor-pointer"
                  : "bg-[#1E293B] text-[#4A5568] cursor-not-allowed border border-[#334155]"
              }`}
            >
              I have read the Privacy Policy
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
