"use client";

import { useRef } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function CookiePolicyPage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-screen bg-white" style={{ color: "#0F172A" }}>
      {/* Header */}
      <header className="shrink-0 border-b border-slate-100 bg-white px-6 py-4 z-40">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/settings/support-legal" className="flex items-center gap-2 outline-none">
            <RovvyLogo variant="primary" size="sm" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0F766E" }}>
            Cookie Policy
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <main className="mx-auto max-w-[800px] px-10 pt-16 pb-12">

          {/* Title block */}
          <div className="mb-12">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4" }}
            >
              Last Updated: June 2026 &nbsp;·&nbsp; Version 1.0
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
              Cookie Policy
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              This policy explains how Rovvy uses cookies and similar tracking technologies.
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">01.</span> What Are Cookies?
              </h2>
              <p>
                Cookies are small text files stored on your device when you visit a website or use an application. They help websites remember your preferences, keep you logged in, and understand how you interact with the service.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">02.</span> Types of Cookies We Use
              </h2>
              <div className="space-y-5">
                {[
                  {
                    name: "Essential Cookies",
                    desc: "These cookies are strictly necessary for the Service to function. They include authentication tokens, session management, and security features. Without these, you cannot stay logged in or use core features of Rovvy.",
                  },
                  {
                    name: "Functional Cookies",
                    desc: "These cookies remember your preferences such as language, currency, and display settings so you do not have to reconfigure them on every visit.",
                  },
                  {
                    name: "Analytics Cookies",
                    desc: "We use limited analytics technologies to understand how users interact with the platform, which features are most used, and where performance improvements can be made. Analytics data is aggregated and not linked to individual identities.",
                  },
                ].map(({ name, desc }) => (
                  <div key={name} className="rounded-lg p-4" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <p className="font-semibold mb-1" style={{ color: "#0F172A" }}>{name}</p>
                    <p className="text-sm" style={{ color: "#4B5563" }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">03.</span> Cookies We Do Not Use
              </h2>
              <p
                className="rounded-lg p-4 text-sm font-medium"
                style={{ background: "#F0FDFA", border: "1px solid #99F6E4", color: "#0F766E" }}
              >
                Rovvy does not use advertising cookies, third-party tracking pixels, or behavioral profiling cookies. We do not sell data to advertising networks. Rovvy is ad-free.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">04.</span> Local Storage and Similar Technologies
              </h2>
              <p>
                In addition to cookies, Rovvy may use local storage (localStorage) to store session tokens and user preferences on your device. This data remains on your device and is not transmitted to third parties for advertising purposes.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">05.</span> Third-Party Cookies
              </h2>
              <p>
                Some features of the Service may integrate with third-party providers (such as maps, analytics, or booking services) that may set their own cookies. These are governed by the respective third-party privacy and cookie policies. Rovvy does not control these cookies.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">06.</span> Managing Cookies
              </h2>
              <p className="mb-3">
                You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. Note that disabling certain cookies may affect the functionality of the Service, including the ability to stay signed in.
              </p>
              <p>
                To manage cookies, refer to the help documentation for your browser:
              </p>
              <ul className="mt-3 space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                <li>Chrome: Settings → Privacy and Security → Cookies</li>
                <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
                <li>Safari: Preferences → Privacy → Manage Website Data</li>
                <li>Edge: Settings → Cookies and Site Permissions</li>
              </ul>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">07.</span> Changes to This Policy
              </h2>
              <p>
                We may update this Cookie Policy from time to time. Material changes will be communicated via in-app notification or email. Continued use of the Service after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">08.</span> Contact
              </h2>
              <div
                className="rounded-lg p-5 space-y-1 text-sm"
                style={{ background: "#F0FDFA", border: "1px solid #99F6E4" }}
              >
                <p className="font-semibold" style={{ color: "#0F172A" }}>Rovvy Privacy Team</p>
                <p>
                  <span style={{ color: "#6B7280" }}>Email: </span>
                  <a href="mailto:privacy@rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                    privacy@rovvy.app
                  </a>
                </p>
                <p>
                  <span style={{ color: "#6B7280" }}>Website: </span>
                  <a href="https://rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                    https://rovvy.app
                  </a>
                </p>
              </div>
            </section>

          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t bg-white px-6 py-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="mx-auto flex max-w-[800px] items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "#6B7280" }}>
            Questions?{" "}
            <a href="mailto:privacy@rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
              privacy@rovvy.app
            </a>
          </p>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#6B7280" }}>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-stone-800" style={{ color: "#0F766E" }}>Privacy Policy</Link>
            <Link href="/terms" className="underline underline-offset-2 hover:text-stone-800" style={{ color: "#0F766E" }}>Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
