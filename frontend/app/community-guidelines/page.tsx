"use client";

import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";
import { SettingsBreadcrumb, legalCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function CommunityGuidelinesPage() {
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
            Community Guidelines
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <SettingsBreadcrumb crumbs={legalCrumbs("Community Guidelines")} />
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
              Community Guidelines
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              Standards for the Rovvy Community
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

            {/* Intro */}
            <section>
              <div className="space-y-3">
                <p>
                  Rovvy exists to help travelers plan, explore, and experience journeys together. Our mission is to create a trusted platform where individuals, friends, families, and groups can travel safely and connect meaningfully.
                </p>
                <p>
                  These Community Guidelines apply to all users of Rovvy, including features such as Trip LIVE, Rovvy Lounge, messaging, AI experiences, maps, and future services.
                </p>
                <p
                  className="rounded-lg p-4 text-sm font-medium"
                  style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#92400E" }}
                >
                  Failure to follow these guidelines may result in content removal, feature restrictions, account suspension, or permanent account termination.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 1 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">01.</span> Respect Other Travelers
              </h2>
              <div className="space-y-3">
                <p>Treat all members of the Rovvy community with respect and courtesy.</p>
                <p>Users must not:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Harass, threaten, or intimidate others</li>
                  <li>Engage in bullying or abusive behavior</li>
                  <li>Use hate speech or discriminatory language</li>
                  <li>Encourage violence or harm</li>
                  <li>Target individuals based on race, nationality, religion, gender, disability, or other protected characteristics</li>
                </ul>
                <p>Respect cultural differences and local customs when interacting with travelers worldwide.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 2 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">02.</span> Authentic Identity and Accounts
              </h2>
              <div className="space-y-3">
                <p>Rovvy is built on trust.</p>
                <p>Users may not:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Create fake accounts</li>
                  <li>Impersonate another person or organization</li>
                  <li>Misrepresent their identity or affiliations</li>
                  <li>Use misleading profile information</li>
                  <li>Pretend to represent Rovvy without authorization</li>
                </ul>
                <p>Users are responsible for maintaining accurate account information.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 3 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">03.</span> Safe Travel and Responsible Use
              </h2>
              <div className="space-y-3">
                <p>Travel involves personal responsibility.</p>
                <p>Users should:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Exercise caution when meeting others</li>
                  <li>Follow destination laws and regulations</li>
                  <li>Respect local customs and cultures</li>
                  <li>Verify travel information independently</li>
                  <li>Use sound judgment while traveling</li>
                </ul>
                <p>Rovvy is a travel coordination platform and does not guarantee the safety or actions of other users.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 4 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">04.</span> Trip LIVE and Location Sharing
              </h2>
              <div className="space-y-3">
                <p>Trip LIVE allows users to share location information with trusted groups.</p>
                <p>Users must understand:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Location sharing is optional</li>
                  <li>Users control who can see their location</li>
                  <li>GPS data may be inaccurate</li>
                  <li>Trip LIVE is not an emergency service</li>
                  <li>Users should contact local emergency services during emergencies</li>
                </ul>
                <p>Misuse of location sharing features is prohibited. Examples include:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Tracking individuals without consent</li>
                  <li>Stalking or harassment</li>
                  <li>Sharing another user's location without permission</li>
                </ul>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 5 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">05.</span> Messaging and Rovvy Lounge
              </h2>
              <div className="space-y-3">
                <p>Rovvy Lounge is intended for respectful communication.</p>
                <p>Users may not:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Send spam or unsolicited messages</li>
                  <li>Share malicious links or malware</li>
                  <li>Engage in scams or phishing</li>
                  <li>Harass or threaten others</li>
                  <li>Distribute misleading information</li>
                </ul>
                <p>Respect the privacy and boundaries of other users.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 6 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">06.</span> Fraud and Scams
              </h2>
              <div className="space-y-3">
                <p>Rovvy does not tolerate fraudulent activity.</p>
                <p>Prohibited activities include:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Fake travel offers</li>
                  <li>Ticket scams</li>
                  <li>Payment fraud</li>
                  <li>Misleading bookings</li>
                  <li>Financial deception</li>
                  <li>Identity theft</li>
                  <li>Phishing attempts</li>
                </ul>
                <p>Users should report suspicious activity immediately.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 7 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">07.</span> Illegal Activities
              </h2>
              <div className="space-y-3">
                <p>Users may not use Rovvy to facilitate or promote illegal activities.</p>
                <p>Examples include:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Human trafficking</li>
                  <li>Drug trafficking</li>
                  <li>Illegal services</li>
                  <li>Criminal enterprises</li>
                  <li>Distribution of unlawful content</li>
                  <li>Violations of applicable laws</li>
                </ul>
                <p>Rovvy may cooperate with law enforcement where legally required.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 8 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">08.</span> Child Safety
              </h2>
              <div className="space-y-3">
                <p>Rovvy is intended for users aged eighteen (18) and older.</p>
                <p
                  className="rounded-lg p-4 text-sm font-medium"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}
                >
                  We have zero tolerance for child exploitation, sexual content involving minors, grooming behavior, or harmful interactions involving minors. Accounts violating child safety policies may be permanently removed and reported to appropriate authorities.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 9 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">09.</span> Content Standards
              </h2>
              <div className="space-y-3">
                <p>Users are responsible for content they upload or share.</p>
                <p>Do not post or distribute:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Illegal content</li>
                  <li>Violent or graphic material</li>
                  <li>Sexually explicit content</li>
                  <li>Harmful or dangerous instructions</li>
                  <li>Malware or malicious files</li>
                  <li>Content that infringes intellectual property rights</li>
                </ul>
                <p>Users must have appropriate rights to upload content.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 10 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">10.</span> Intellectual Property
              </h2>
              <div className="space-y-3">
                <p>Respect intellectual property rights.</p>
                <p>Users may not:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Upload copyrighted material without permission</li>
                  <li>Reproduce protected works unlawfully</li>
                  <li>Use another person's content without authorization</li>
                </ul>
                <p>Rovvy may remove content that violates intellectual property rights.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 11 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">11.</span> AI and Wayra
              </h2>
              <div className="space-y-3">
                <p>Wayra and other AI-powered features are provided for informational purposes.</p>
                <p>Users should understand:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>AI-generated outputs may be inaccurate</li>
                  <li>AI does not replace professional advice</li>
                  <li>Travel decisions should be independently verified</li>
                  <li>AI features may evolve over time</li>
                </ul>
                <p>Users may not use AI tools to deceive, harass, or mislead others.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 12 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">12.</span> Enforcement and Account Actions
              </h2>
              <div className="space-y-3">
                <p>Rovvy may take action when these guidelines are violated.</p>
                <p>Actions may include:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Warning notices</li>
                  <li>Content removal</li>
                  <li>Feature restrictions</li>
                  <li>Temporary suspension</li>
                  <li>Permanent account termination</li>
                </ul>
                <p>Enforcement decisions consider severity, frequency, and risk to the community.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 13 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">13.</span> Reporting and Appeals
              </h2>
              <div className="space-y-3">
                <p>Users are encouraged to report:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Abuse</li>
                  <li>Fraud</li>
                  <li>Unsafe behavior</li>
                  <li>Content violations</li>
                  <li>Security concerns</li>
                </ul>
                <p>Where appropriate, users may contact Rovvy to request review of enforcement actions.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 14 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">14.</span> Updates to These Guidelines
              </h2>
              <div className="space-y-3">
                <p>Rovvy may update these Community Guidelines from time to time.</p>
                <p>Material changes may be communicated through:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Website notices</li>
                  <li>Email notifications</li>
                  <li>In-app messages</li>
                </ul>
                <p>Continued use of Rovvy after updates constitutes acceptance of the revised Guidelines.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 15 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">15.</span> Contact Information
              </h2>
              <p className="mb-4">For questions regarding these Community Guidelines:</p>
              <div
                className="rounded-lg p-5 space-y-1.5 text-sm"
                style={{ background: "#F0FDFA", border: "1px solid #99F6E4" }}
              >
                <p className="font-semibold" style={{ color: "#0F172A" }}>Rovvy Community Team</p>
                <p>
                  <span style={{ color: "#6B7280" }}>Email: </span>
                  <a href="mailto:community@rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                    community@rovvy.app
                  </a>
                </p>
                <p>
                  <span style={{ color: "#6B7280" }}>Website: </span>
                  <a href="https://rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                    https://rovvy.app
                  </a>
                </p>
              </div>
              <p className="mt-5 text-sm text-center italic" style={{ color: "#6B7280" }}>
                Together, we can build a trusted community for travelers worldwide.
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
            <a href="mailto:community@rovvy.app" className="underline underline-offset-2" style={{ color: "#0F766E" }}>
              community@rovvy.app
            </a>
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-stone-800 transition-colors" style={{ color: "#0F766E" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline underline-offset-2 hover:text-stone-800 transition-colors" style={{ color: "#0F766E" }}>
              Terms of Service
            </Link>
            <Link href="/cookie-policy" className="underline underline-offset-2 hover:text-stone-800 transition-colors" style={{ color: "#0F766E" }}>
              Cookie Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
