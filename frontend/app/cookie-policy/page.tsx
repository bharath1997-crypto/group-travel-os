"use client";

import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";
import { SettingsBreadcrumb, legalCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function CookiePolicyPage() {
  return (
    <div className="flex flex-col h-screen bg-white" style={{ color: "#0F172A" }}>
      {/* Header */}
      <header className="shrink-0 border-b border-slate-100 bg-white px-6 py-4 z-40">
        <div className="flex items-center justify-between">
          <Link
            href="/settings/support-legal"
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm font-medium transition-colors hover:bg-stone-50 outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            style={{ color: "#0F172A" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <RovvyLogo variant="primary" size="sm" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0F766E" }}>
            Cookie Policy
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <SettingsBreadcrumb crumbs={legalCrumbs("Cookie Policy")} />
        <main className="px-6 sm:px-10 pt-10 pb-16">

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
            How we use cookies and similar tracking technologies across the Rovvy platform.
          </p>
        </div>

        <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

          {/* 1 — Introduction */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">01.</span> Introduction
            </h2>
            <div className="space-y-3">
              <p>
                This Cookie Policy explains how Rovvy ("Rovvy," "we," "us," or "our") uses cookies and similar tracking technologies when you access or use the Rovvy platform, including our website, web application, and related services (collectively, the "Service").
              </p>
              <p>
                By using the Service, you consent to the use of cookies and tracking technologies as described in this policy. This Cookie Policy is incorporated into and forms part of our Privacy Policy. Please read both documents to understand our full data practices.
              </p>
              <p>
                If you have questions about this policy or wish to exercise any rights related to your data, please contact us at{" "}
                <a href="mailto:privacy@rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                  privacy@rovvy.app
                </a>.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 2 — What Are Cookies? */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">02.</span> What Are Cookies?
            </h2>
            <div className="space-y-3">
              <p>
                Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit a website or use a web application. They are widely used to make websites work more efficiently, remember your preferences, and provide information to website operators.
              </p>
              <p>
                In addition to cookies, we may use similar technologies such as web beacons, pixel tags, local storage (localStorage), and session storage. For the purposes of this policy, all such technologies are referred to collectively as "cookies."
              </p>
              <p>
                Cookies may be either "session cookies" — which expire when you close your browser — or "persistent cookies," which remain on your device for a defined period or until you delete them. Cookies may be set by Rovvy directly ("first-party cookies") or by third-party services we use ("third-party cookies").
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 3 — Why We Use Cookies */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">03.</span> Why We Use Cookies
            </h2>
            <div className="space-y-3">
              <p>Rovvy uses cookies for the following purposes:</p>
              <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                <li><strong>Authentication:</strong> To verify your identity and keep you securely signed in to your Rovvy account across sessions.</li>
                <li><strong>Session management:</strong> To maintain your session state so that your activity and navigation are consistent throughout your visit.</li>
                <li><strong>Security:</strong> To detect and prevent fraudulent activity, unauthorized access, and other security threats.</li>
                <li><strong>Preferences:</strong> To remember your settings, such as language, region, display preferences, and in-app configurations.</li>
                <li><strong>Analytics and performance:</strong> To understand how users interact with the platform, identify areas for improvement, and monitor system performance. Analytics data is aggregated and does not identify individual users.</li>
                <li><strong>Affiliate tracking:</strong> To recognize affiliate referrals and appropriately credit partners when you reach Rovvy through an affiliate link.</li>
              </ul>
              <p>
                Rovvy does not use cookies for advertising purposes. We do not serve targeted or behavioral advertising, and we do not build advertising profiles based on your activity.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 4 — Types of Cookies We Use */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">04.</span> Types of Cookies We Use
            </h2>
            <div className="space-y-4">
              {[
                {
                  name: "Strictly Necessary Cookies",
                  desc: "These cookies are essential for the Service to function and cannot be disabled. They include authentication tokens stored in localStorage (your JWT session token \"gt_token\"), CSRF protection tokens, and security cookies. Without these, core features such as signing in, accessing trips, and using the platform are unavailable.",
                },
                {
                  name: "Functional Cookies",
                  desc: "These cookies remember your choices and preferences so the Service behaves consistently across visits. Examples include language and region settings, display preferences, and feature configuration. Disabling these may mean you need to reconfigure preferences on each visit.",
                },
                {
                  name: "Analytics and Performance Cookies",
                  desc: "We use limited analytics technologies to understand aggregate usage patterns — such as which features are most used, where users encounter issues, and how the application performs across devices. Analytics data is anonymized or pseudonymized and is not linked to your personal identity.",
                },
                {
                  name: "Local Storage",
                  desc: "Rovvy uses browser localStorage to store your session token (gt_token), cached map data, device-side search results, and user preferences. This data is stored locally on your device and is not transmitted to third parties for advertising or profiling purposes.",
                },
              ].map(({ name, desc }) => (
                <div key={name} className="rounded-lg p-4" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <p className="font-semibold mb-1.5" style={{ color: "#0F172A" }}>{name}</p>
                  <p className="text-sm" style={{ color: "#4B5563", lineHeight: "1.7" }}>{desc}</p>
                </div>
              ))}
            </div>

            {/* No advertising cookies callout */}
            <div
              className="mt-5 rounded-lg p-4 text-sm font-medium"
              style={{ background: "#F0FDFA", border: "1px solid #99F6E4", color: "#0F766E" }}
            >
              Rovvy does not use advertising cookies, behavioral tracking pixels, or third-party ad network scripts. We do not sell your personal information to advertisers or data brokers. Rovvy is ad-free.
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 5 — Third-Party Services */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">05.</span> Third-Party Services
            </h2>
            <div className="space-y-3">
              <p>
                Some features of the Service integrate with third-party providers that may set their own cookies or use similar technologies. These third parties may include:
              </p>
              <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                <li><strong>Mapping providers</strong> (such as MapLibre, OpenStreetMap, or Google Maps) that may set cookies related to map tile loading and user interactions.</li>
                <li><strong>Authentication providers</strong> (such as Google OAuth) that may set cookies to support sign-in flows.</li>
                <li><strong>Analytics services</strong> that may set persistent or session cookies to collect aggregated usage information.</li>
                <li><strong>Travel and booking partners</strong> that set cookies when you navigate to their services through Rovvy links.</li>
              </ul>
              <p>
                Third-party cookies are governed by the privacy and cookie policies of the respective providers. Rovvy does not control the content or behavior of third-party cookies. We encourage you to review the privacy policies of any third-party services you interact with through Rovvy.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 6 — Affiliate Links and Tracking */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">06.</span> Affiliate Links and Tracking
            </h2>
            <div className="space-y-3">
              <p>
                Rovvy participates in affiliate and referral programs with travel providers, booking platforms, and other partners. When you click an affiliate link within the Service, the destination website or partner service may use referral identifiers, timestamps, session tokens, or cookies to record and attribute the referral.
              </p>
              <p>
                This tracking allows partners to recognize that you arrived through Rovvy and may enable Rovvy to receive a referral commission at no additional cost to you. Rovvy does not share personally identifiable information with affiliate partners beyond what is embedded in standard referral URLs (such as tracking IDs or markers).
              </p>
              <p>
                Affiliate tracking cookies and parameters set by third-party partners are governed by their own privacy and cookie policies. Rovvy does not control how affiliate partners use referral data after you leave the Rovvy platform.
              </p>
              <p>
                Commission arrangements do not influence the travel recommendations, search results, or content shown to you within Rovvy. All affiliate relationships that materially affect pricing or results are disclosed within the Service.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 7 — Managing Cookies */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">07.</span> Managing Cookies
            </h2>
            <div className="space-y-3">
              <p>
                You have the right to accept, decline, or manage cookies through your browser or device settings. Most browsers provide controls to block or delete cookies, clear localStorage, and prevent future cookies from being set.
              </p>
              <p>
                Please note that disabling certain cookies — particularly strictly necessary cookies and localStorage entries — may significantly affect the functionality of the Service. For example, blocking authentication tokens will prevent you from staying signed in, and clearing localStorage may reset your preferences and cached data.
              </p>
              <p>To manage cookies in your browser, refer to the following guides:</p>
              <ul className="mt-2 space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies and other site data</li>
                <li><strong>Firefox:</strong> Settings → Privacy &amp; Security → Cookies and Site Data</li>
                <li><strong>Safari:</strong> Settings → Privacy → Manage Website Data</li>
                <li><strong>Edge:</strong> Settings → Cookies and Site Permissions → Manage and delete cookies</li>
                <li><strong>Mobile (iOS/Android):</strong> Browser settings → Privacy → Clear Browsing Data</li>
              </ul>
              <p>
                To clear localStorage used by Rovvy, you can use your browser's developer tools (Application → Local Storage → rovvy.app → Clear) or clear all site data through browser privacy settings.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 8 — Do Not Track */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">08.</span> Do Not Track Signals
            </h2>
            <div className="space-y-3">
              <p>
                Some browsers offer a "Do Not Track" (DNT) setting that signals to websites that you do not wish to be tracked. Because there is currently no industry-wide standard for honoring DNT signals, Rovvy does not alter its data collection practices in response to DNT signals from browsers.
              </p>
              <p>
                However, because Rovvy does not use advertising cookies or build behavioral advertising profiles, your browsing on the Rovvy platform is not used for targeted advertising regardless of your DNT setting.
              </p>
              <p>
                If you wish to limit tracking more broadly, we recommend using browser privacy extensions or adjusting cookie settings as described in the Managing Cookies section above.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 9 — International Users */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">09.</span> International Users
            </h2>
            <div className="space-y-3">
              <p>
                Rovvy is accessible globally. Cookie laws and privacy regulations vary by country and region. If you are accessing the Service from within the European Economic Area (EEA), the United Kingdom, or other jurisdictions with specific cookie consent requirements, please be aware that:
              </p>
              <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                <li>Strictly necessary cookies may be set without explicit consent as they are required for the Service to function.</li>
                <li>Non-essential cookies (such as analytics cookies) may require your consent depending on local law.</li>
                <li>You have the right to withdraw consent for non-essential cookies at any time through your browser settings.</li>
              </ul>
              <p>
                Data associated with cookies may be processed in the United States or in other countries where Rovvy or its service providers operate. By using the Service, you acknowledge that your information may be transferred to and processed in jurisdictions outside your home country, which may have different data protection laws.
              </p>
              <p>
                For questions about cross-border data transfers or your rights as an international user, contact us at{" "}
                <a href="mailto:privacy@rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                  privacy@rovvy.app
                </a>.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 10 — Changes */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">10.</span> Changes to This Cookie Policy
            </h2>
            <div className="space-y-3">
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices, technology, legal requirements, or for other operational reasons. The "Last Updated" date at the top of this page indicates when the policy was most recently revised.
              </p>
              <p>
                Material changes to this policy will be communicated through in-app notifications, email, or a prominent notice on the Service. We encourage you to review this policy periodically to stay informed about how we use cookies.
              </p>
              <p>
                Continued use of the Service following notification of changes constitutes your acceptance of the updated Cookie Policy. If you do not agree to the revised policy, you should discontinue use of the Service.
              </p>
            </div>
          </section>

          <hr style={{ borderColor: "#F1F5F9" }} />

          {/* 11 — Contact */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
              <span className="font-mono text-sm">11.</span> Contact Information
            </h2>
            <p className="mb-4">
              If you have questions, concerns, or requests related to this Cookie Policy or our use of tracking technologies, please contact the Rovvy Privacy Team:
            </p>
            <div
              className="rounded-lg p-5 space-y-1.5 text-sm"
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
            <p className="mt-4 text-sm italic" style={{ color: "#6B7280" }}>
              By using Rovvy, you acknowledge that you have read and understood this Cookie Policy.
            </p>
          </section>

        </div>{/* end space-y-10 */}
        </main>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t bg-white px-6 py-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs" style={{ color: "#6B7280" }}>
            Questions?{" "}
            <a href="mailto:privacy@rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
              privacy@rovvy.app
            </a>
          </p>
          <div className="flex items-center gap-4 text-xs" style={{ color: "#6B7280" }}>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-stone-800 transition-colors" style={{ color: "#0F766E" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline underline-offset-2 hover:text-stone-800 transition-colors" style={{ color: "#0F766E" }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
