"use client";

import { useRef } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function PrivacyPage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-screen bg-white" style={{ color: "#0F172A" }}>
      {/* Header */}
      <header className="shrink-0 border-b border-slate-100 bg-white px-6 py-4 z-40">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 outline-none">
            <RovvyLogo variant="primary" size="sm" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0F766E" }}>
            Legal
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <main className="mx-auto max-w-[800px] px-10 pt-16 pb-20">

          {/* Title block */}
          <div className="mb-12">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4" }}
            >
              Last Updated: June 2026 &nbsp;·&nbsp; Version 2.0
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
              Privacy Policy
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              We take your privacy seriously. Here is exactly what we collect and why.
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

            {/* Section 1 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">01.</span> Introduction
              </h2>
              <p>
                Rovvy ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use rovvy.app.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 2 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">02.</span> Information We Collect
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Information you provide:</h3>
                  <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Name, email address, and password when you register</li>
                    <li>Profile photo and travel preferences</li>
                    <li>Trip details, itineraries, and group information</li>
                    <li>Messages sent through Rovvy Lounge (stored encrypted)</li>
                    <li>Expense and payment split information</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Information collected automatically:</h3>
                  <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Device type, browser, and operating system</li>
                    <li>IP address and approximate location (city-level)</li>
                    <li>Pages visited and features used within the app</li>
                    <li>Search queries within the app (query text only, never coordinates)</li>
                    <li>Crash reports and performance data</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Location data (with permission):</h3>
                  <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Precise GPS location during Trip LIVE mode only</li>
                    <li>Used solely for real-time group coordination</li>
                    <li>Never stored permanently on our servers</li>
                    <li>Never sold or shared with advertisers</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 3 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">03.</span> How We Use Your Information
              </h2>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>To provide and improve the Rovvy Service</li>
                <li>To send trip-related notifications and updates</li>
                <li>To personalize your experience and recommendations</li>
                <li>To process and coordinate group activities</li>
                <li>To communicate important service updates</li>
                <li>To prevent fraud and ensure platform security</li>
                <li>To analyze usage patterns and improve features</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 4 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">04.</span> Information Sharing
              </h2>
              <p className="mb-4">
                We do not sell your personal information. We share data only with:
              </p>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>Service providers who help operate Rovvy (hosting, email, analytics)</li>
                <li>Third-party booking partners when you click affiliate links (only what is necessary to complete your search)</li>
                <li>Law enforcement when legally required</li>
                <li>Other users in your trip group (trip details, name, profile photo)</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 5 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">05.</span> Affiliate Services
              </h2>
              <p>
                Rovvy earns commissions through affiliate partnerships with Travelpayouts (flights), Viator (activities), Ticketmaster, and Eventbrite (events). When you click these links, minimal data (session ID, click timestamp) is shared with partners to track commissions. No personal identifying information is shared without your explicit action.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 6 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">06.</span> Data Retention
              </h2>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>Account data: retained while your account is active</li>
                <li>Trip data: retained for 2 years after trip end date</li>
                <li>Search logs: retained for 90 days then automatically deleted</li>
                <li>Location data from LIVE mode: never permanently stored</li>
                <li>Deleted account data: removed within 30 days</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 7 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">07.</span> Your Rights
              </h2>
              <p className="mb-4">You have the right to:</p>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>Access your personal data (download via profile settings)</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of marketing communications</li>
                <li>Disable location sharing at any time</li>
                <li>Request data portability</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 8 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">08.</span> Data Security
              </h2>
              <p className="mb-4">We implement industry-standard security measures including:</p>
              <ul className="space-y-2 pl-5" style={{ listStyleType: "disc" }}>
                <li>TLS encryption for all data in transit</li>
                <li>Encrypted storage for sensitive data</li>
                <li>JWT authentication with secure token management</li>
                <li>Regular security audits and monitoring</li>
                <li>Google Cloud infrastructure with SOC 2 compliance</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 9 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">09.</span> Cookies and Tracking
              </h2>
              <p className="mb-4">Rovvy uses minimal cookies for:</p>
              <ul className="space-y-2 pl-5 mb-4" style={{ listStyleType: "disc" }}>
                <li>Authentication (keeping you logged in)</li>
                <li>Session management</li>
                <li>Performance monitoring</li>
              </ul>
              <p>
                We do not use advertising cookies or sell data to ad networks. Rovvy products are ad-free.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 10 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">10.</span> Children's Privacy
              </h2>
              <p>
                Rovvy is not directed at children under 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us information, contact us immediately.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 11 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">11.</span> International Users
              </h2>
              <p>
                Rovvy is operated from the United States. If you access the Service from outside the US, your data may be transferred to and processed in the US. By using Rovvy, you consent to this transfer.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 12 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">12.</span> Changes to Privacy Policy
              </h2>
              <p>
                We will notify you of material changes via email or in-app notification at least 30 days before they take effect.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* Section 13 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">13.</span> Contact
              </h2>
              <p className="mb-2">For privacy questions or data requests:</p>
              <p>
                <span className="font-semibold" style={{ color: "#0F172A" }}>Email:</span>{" "}
                <a href="mailto:privacy@rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
                  privacy@rovvy.app
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

      {/* Footer nav */}
      <footer className="shrink-0 border-t bg-white px-6 py-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="mx-auto flex max-w-[800px] items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "#6B7280" }}>
            Questions? Email{" "}
            <a href="mailto:privacy@rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
              privacy@rovvy.app
            </a>
          </p>
          <Link
            href="/terms"
            className="text-xs font-semibold underline underline-offset-2"
            style={{ color: "#0F766E" }}
          >
            View Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
