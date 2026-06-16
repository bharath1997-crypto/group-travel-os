"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function TermsPage() {
  const [reachedBottom, setReachedBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isRead = localStorage.getItem("rovvy_terms_read") === "true";
      if (isRead) {
        setAccepted(true);
        setReachedBottom(true);
      }
    }
  }, []);

  useEffect(() => {
    if (accepted) return;
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
        setReachedBottom(true);
      }
    };

    el.addEventListener("scroll", check);
    const timer = setTimeout(check, 300);
    return () => {
      el.removeEventListener("scroll", check);
      clearTimeout(timer);
    };
  }, [accepted]);

  const handleAccept = () => {
    if (!reachedBottom) return;
    localStorage.setItem("rovvy_terms_read", "true");
    setAccepted(true);
  };

  return (
    <div className="flex flex-col h-screen bg-white" style={{ color: "#0F172A" }}>
      {/* Header */}
      <header className="shrink-0 border-b border-slate-100 bg-white px-6 py-4 z-40">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 outline-none">
            <RovvyLogo variant="primary" size="sm" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0F766E" }}>
            Legal Agreement
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <main className="mx-auto max-w-[800px] px-10 pt-16 pb-12">

          {/* Title block */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4" }}>
              Last Updated: June 2026 &nbsp;·&nbsp; Version 2.0
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
              Terms of Service
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              Please read these terms carefully before using Rovvy.
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

            {/* Section 1 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">01.</span> Acceptance of Terms
              </h2>
              <p>
                Rovvy ("we," "us," "our") operates rovvy.app, a group travel planning and coordination platform. By accessing or using Rovvy, you agree to these Terms. If you disagree, do not use the Service.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 2 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">02.</span> Description of Service
              </h2>
              <p className="mb-4">
                Rovvy is a group travel operating system that helps friend groups plan, coordinate, and experience travel together. Core features include:
              </p>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>Group trip planning and itinerary building</li>
                <li>Real-time group coordination and live location sharing</li>
                <li>Activity, event, and experience discovery</li>
                <li>Collaborative voting and decision making</li>
                <li>Shared expense tracking and splitting</li>
                <li>Group messaging and coordination (Rovvy Lounge)</li>
                <li>Flight and accommodation discovery via affiliate partners</li>
                <li>AI-powered trip companion (Wayra)</li>
              </ul>
              <p className="mt-4">
                Rovvy is a discovery and coordination platform, not a travel agency, booking operator, or financial institution. All bookings are made directly with third-party providers subject to their own terms.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 3 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">03.</span> Eligibility
              </h2>
              <p>
                You must be at least 18 years old to use Rovvy. By using the Service, you confirm you meet this requirement and have legal capacity to enter into these Terms.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 4 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">04.</span> User Accounts
              </h2>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must provide accurate, current information</li>
                <li>You may not share your account credentials</li>
                <li>You must notify us immediately of unauthorized access</li>
                <li>We reserve the right to suspend accounts violating these Terms</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 5 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">05.</span> User Content
              </h2>
              <p>
                You retain ownership of content you post on Rovvy. By posting, you grant Rovvy a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content solely to operate the Service. You are solely responsible for your content and confirm it does not violate any laws or third-party rights.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 6 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">06.</span> Prohibited Conduct
              </h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>Use the Service for any unlawful purpose</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Post false, misleading, or fraudulent content</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Scrape, crawl, or extract data from the Service without permission</li>
                <li>Impersonate any person or entity</li>
                <li>Interfere with the proper functioning of the Service</li>
                <li>Use the Service to send spam or unsolicited communications</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 7 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">07.</span> Third-Party Services and Affiliate Links
              </h2>
              <p>
                Rovvy integrates with and links to third-party services including flight search (via Travelpayouts), activities (via Viator), events (via Ticketmaster, Eventbrite), and maps (OpenStreetMap). We may earn affiliate commissions when you click or book through these links at no additional cost to you. Rovvy is not responsible for third-party content, pricing, availability, or service quality.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 8 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">08.</span> Location Data
              </h2>
              <p>
                Trip LIVE mode and map features use your device's GPS with your explicit permission. Location data is used solely to provide real-time coordination features and is never sold to third parties. You can disable location access at any time through your device settings.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 9 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">09.</span> Intellectual Property
              </h2>
              <p>
                All Rovvy branding, design, software, and original content are owned by Rovvy and protected by applicable intellectual property laws. You may not copy, modify, or distribute our proprietary materials without written permission.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 10 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">10.</span> Disclaimer of Warranties
              </h2>
              <p className="uppercase text-sm tracking-wide font-medium" style={{ color: "#374151" }}>
                The service is provided "as is" without warranties of any kind, express or implied. Rovvy does not warrant that the service will be uninterrupted, error-free, or free of viruses or other harmful components.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 11 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">11.</span> Limitation of Liability
              </h2>
              <p className="uppercase text-sm tracking-wide font-medium" style={{ color: "#374151" }}>
                To the maximum extent permitted by law, Rovvy shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service, including but not limited to loss of data, loss of profits, or personal injury.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 12 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">12.</span> Indemnification
              </h2>
              <p>
                You agree to indemnify and hold harmless Rovvy, its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 13 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">13.</span> Termination
              </h2>
              <p>
                We reserve the right to suspend or terminate your account at any time for violation of these Terms or any conduct we deem harmful to the Service or other users. You may delete your account at any time from your profile settings.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 14 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">14.</span> Governing Law
              </h2>
              <p>
                These Terms are governed by the laws of the State of Illinois, United States, without regard to conflict of law principles.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 15 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">15.</span> Changes to Terms
              </h2>
              <p>
                We may update these Terms periodically. We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 16 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">16.</span> Contact
              </h2>
              <p className="mb-2">For questions about these Terms:</p>
              <p>
                <span className="font-semibold" style={{ color: "#0F172A" }}>Email:</span>{" "}
                <a href="mailto:legal@rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
                  legal@rovvy.app
                </a>
              </p>
              <p>
                <span className="font-semibold" style={{ color: "#0F172A" }}>Website:</span>{" "}
                <a href="https://rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
                  https://rovvy.app
                </a>
              </p>
            </section>

          </div>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="shrink-0 border-t bg-white px-6 py-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="mx-auto flex max-w-[800px] flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-center sm:text-left" style={{ color: "#6B7280" }}>
            {!reachedBottom
              ? "Scroll to the bottom to read all terms and unlock the button."
              : accepted
                ? "You have successfully acknowledged the Terms of Service."
                : "You have read the terms. Click to confirm and unlock registration."}
          </p>

          {accepted ? (
            <div
              className="flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold"
              style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Terms Acknowledged
            </div>
          ) : (
            <button
              onClick={handleAccept}
              disabled={!reachedBottom}
              className="flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all"
              style={
                reachedBottom
                  ? { background: "#0F766E", color: "#FFFFFF", cursor: "pointer" }
                  : { background: "#F1F5F9", color: "#94A3B8", cursor: "not-allowed", border: "1px solid #E2E8F0" }
              }
            >
              I have read the Terms
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
