"use client";

import { useRef } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";
import { SettingsBreadcrumb, legalCrumbs } from "@/components/settings/SettingsBreadcrumb";

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
            Privacy Policy
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <SettingsBreadcrumb crumbs={legalCrumbs("Privacy Policy")} />
        <main className="mx-auto max-w-[800px] px-10 pt-10 pb-12">

          {/* Title block */}
          <div className="mb-12">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
              style={{ background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4" }}
            >
              Last Updated: June 2026 &nbsp;·&nbsp; Version 3.0
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
              Privacy Policy
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              We are committed to protecting your privacy. This policy explains exactly what we collect, why, and how.
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

            {/* 1 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">01.</span> Introduction
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy ("Rovvy," "we," "us," or "our") is committed to protecting the privacy and security of our users. This Privacy Policy explains how we collect, use, disclose, store, transfer, and protect personal information when you access or use the Rovvy platform, including our website, mobile applications, APIs, and related services (collectively, the "Service").
                </p>
                <p>
                  Rovvy is a travel coordination and social platform that enables users to plan trips, coordinate travel experiences, share locations with trusted groups, communicate with fellow travelers, track expenses, and discover travel-related experiences.
                </p>
                <p>
                  By accessing or using the Service, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with this Policy, please discontinue use of the Service.
                </p>
                <p>
                  This Privacy Policy applies to all users worldwide and is intended to comply with applicable privacy laws, including, where applicable, the General Data Protection Regulation ("GDPR"), the California Consumer Privacy Act ("CCPA"), the California Privacy Rights Act ("CPRA"), and other applicable data protection laws.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 2 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">02.</span> Information We Collect
              </h2>
              <p className="mb-5">
                We collect information that you provide directly, information collected automatically through use of the Service, and information received from third parties.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Information You Provide</h3>
                  <p className="mb-3">Depending on how you use Rovvy, we may collect:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Full name or display name</li>
                    <li>Email address</li>
                    <li>Account credentials and authentication information</li>
                    <li>Profile photo and profile details</li>
                    <li>Travel preferences and interests</li>
                    <li>Trip details, itineraries, and schedules</li>
                    <li>Group membership information</li>
                    <li>Reviews, comments, and feedback</li>
                    <li>Expense tracking and settlement information</li>
                    <li>Messages and communications through Rovvy features</li>
                    <li>Contact information voluntarily provided by users</li>
                    <li>Support requests and customer service communications</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Authentication Information</h3>
                  <p className="mb-3">
                    If you register or sign in through third-party providers such as Google or Facebook, we may receive information from those providers, including:
                  </p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Name</li>
                    <li>Email address</li>
                    <li>Profile image</li>
                    <li>Unique account identifiers</li>
                    <li>Authentication tokens required to maintain your session</li>
                  </ul>
                  <p className="mt-3">Your use of third-party authentication services remains subject to their own privacy policies and terms.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Information Collected Automatically</h3>
                  <p className="mb-3">When you use the Service, we may automatically collect technical and usage information, including:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>IP address</li>
                    <li>Browser type and version</li>
                    <li>Device type and operating system</li>
                    <li>Language preferences</li>
                    <li>Referring URLs</li>
                    <li>Application usage metrics</li>
                    <li>Error logs and crash reports</li>
                    <li>Session identifiers</li>
                    <li>Approximate geographic information derived from IP addresses</li>
                    <li>Features accessed and interactions within the Service</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Search Information</h3>
                  <p className="mb-3">
                    To improve search functionality and platform performance, Rovvy may log search queries entered by users. Search logs may include query text, timestamp, and general session information.
                  </p>
                  <p>
                    Rovvy does not store precise geographic coordinates as part of standard search logs unless explicitly required for the functionality of a specific feature.
                  </p>
                </div>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 3 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">03.</span> Location Information
              </h2>
              <p className="mb-5">
                Certain features of Rovvy, including Trip LIVE and map experiences, rely on location services.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Precise Location Data</h3>
                  <p className="mb-3">With your explicit permission, Rovvy may collect precise GPS location data from your device. Location data may be used to:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Enable Trip LIVE functionality</li>
                    <li>Display group members on maps</li>
                    <li>Coordinate travel activities</li>
                    <li>Improve map-related features</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Location Controls</h3>
                  <p className="mb-3">Location sharing is entirely optional. Users may:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Enable or disable location sharing at any time</li>
                    <li>Restrict access through device settings</li>
                    <li>Control sharing within trip groups</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Location Retention</h3>
                  <p>
                    Rovvy processes location information primarily in real time to support trip coordination features. LIVE location information is not retained permanently beyond operational requirements, except where temporary retention is necessary for security, troubleshooting, fraud prevention, or compliance with legal obligations.
                  </p>
                  <p className="mt-2 font-medium" style={{ color: "#0F172A" }}>
                    Rovvy does not sell location information to advertisers or data brokers.
                  </p>
                </div>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 4 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">04.</span> How We Use Information
              </h2>
              <p className="mb-4">We use personal information for legitimate business and operational purposes, including to:</p>
              <ul className="space-y-1.5 pl-5 mb-4" style={{ listStyleType: "disc" }}>
                <li>Provide and maintain the Service</li>
                <li>Authenticate user accounts</li>
                <li>Create and manage trips</li>
                <li>Enable group collaboration features</li>
                <li>Provide messaging functionality</li>
                <li>Support Trip LIVE experiences</li>
                <li>Process expense tracking features</li>
                <li>Deliver notifications and updates</li>
                <li>Improve search and recommendation systems</li>
                <li>Personalize user experiences</li>
                <li>Detect fraud and security threats</li>
                <li>Monitor platform performance</li>
                <li>Respond to support requests</li>
                <li>Comply with legal obligations</li>
                <li>Enforce our Terms of Service</li>
              </ul>
              <p>
                Where required by applicable law, we process personal information based on legal grounds including user consent, contractual necessity, legitimate interests, and legal compliance.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 5 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">05.</span> Artificial Intelligence and Automated Features
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy may provide AI-powered features and travel assistance through systems such as Wayra. AI functionality may be used to generate itinerary suggestions, summarize trip information, recommend activities and destinations, and assist with travel planning.
                </p>
                <p>
                  AI-generated outputs are provided for informational purposes only and may be inaccurate, incomplete, or outdated. Information processed through AI systems may be handled by third-party AI providers where necessary to provide requested functionality.
                </p>
                <p>
                  Users should independently verify travel information before making decisions or purchases. Rovvy does not use personal information to sell targeted advertising.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 6 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">06.</span> Information Sharing and Disclosure
              </h2>
              <p className="mb-5 font-medium" style={{ color: "#0F172A" }}>
                Rovvy does not sell users' personal information.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Service Providers</h3>
                  <p className="mb-3">We may share information with trusted service providers that assist in operating the Service, including:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Cloud hosting providers</li>
                    <li>Database providers</li>
                    <li>Authentication providers</li>
                    <li>Email delivery services</li>
                    <li>Analytics services</li>
                    <li>Customer support platforms</li>
                    <li>Security and fraud prevention vendors</li>
                  </ul>
                  <p className="mt-3">These providers are contractually obligated to protect information and use it only for authorized purposes.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Trip Participants</h3>
                  <p className="mb-3">Certain information may be visible to members of a trip or group, including:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Display name</li>
                    <li>Profile photo</li>
                    <li>Trip participation</li>
                    <li>Shared itineraries</li>
                    <li>Group messages</li>
                    <li>Shared location information when enabled</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Legal Requirements</h3>
                  <p className="mb-3">We may disclose information where required to:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Comply with legal obligations</li>
                    <li>Respond to lawful requests</li>
                    <li>Protect rights or safety</li>
                    <li>Prevent fraud or abuse</li>
                    <li>Enforce our policies</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Business Transfers</h3>
                  <p>
                    In the event of a merger, acquisition, restructuring, or sale of assets, personal information may be transferred as part of the transaction, subject to applicable law.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Affiliate Partners</h3>
                  <p>
                    When users interact with affiliate links or third-party travel services, limited information necessary to track referrals or facilitate transactions may be shared with applicable partners. Rovvy does not share personally identifiable information with affiliate partners without user action or where otherwise required to provide the requested service.
                  </p>
                </div>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 7 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">07.</span> Data Retention
              </h2>
              <p className="mb-5">
                Rovvy retains personal information only for as long as necessary to fulfill the purposes described in this Privacy Policy, comply with legal obligations, resolve disputes, enforce agreements, and maintain platform security.
              </p>

              <div className="space-y-5">
                {[
                  {
                    label: "Account Information",
                    text: "Retained while your account remains active. If you delete your account, Rovvy will begin the deletion process in accordance with this Privacy Policy and applicable law.",
                  },
                  {
                    label: "Trip Information",
                    text: "Trip data, itineraries, group information, and related travel records may be retained for up to two (2) years following the trip end date to support user experiences, fraud prevention, customer support, and legal compliance.",
                  },
                  {
                    label: "Search Logs",
                    text: "Search queries and related usage information may be retained for up to ninety (90) days and may thereafter be deleted, anonymized, or aggregated for analytics purposes.",
                  },
                  {
                    label: "Messaging Data",
                    text: "Messages may be retained as necessary to provide messaging functionality, maintain service integrity, investigate abuse, enforce policies, and comply with legal obligations. Messages are transmitted using secure protocols and may be encrypted in transit and at rest.",
                  },
                  {
                    label: "Location Data",
                    text: "LIVE location is processed in real time and is not retained permanently except where temporarily necessary for security monitoring, troubleshooting, fraud prevention, or legal compliance.",
                  },
                  {
                    label: "Deleted Accounts",
                    text: "Personal information is generally deleted or anonymized within thirty (30) days of an account deletion request, unless longer retention is required by law, security needs, or fraud prevention. Certain information may remain in backups for limited periods consistent with industry practices.",
                  },
                ].map(({ label, text }) => (
                  <div
                    key={label}
                    className="rounded-lg p-4"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <p className="font-semibold mb-1" style={{ color: "#0F172A" }}>{label}</p>
                    <p className="text-sm" style={{ color: "#4B5563" }}>{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 8 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">08.</span> Data Security
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy implements administrative, technical, and organizational safeguards designed to protect personal information from unauthorized access, disclosure, alteration, loss, or destruction. Security measures may include:
                </p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>TLS encryption for data transmitted over networks</li>
                  <li>Encryption of sensitive data at rest where supported</li>
                  <li>Authentication and authorization controls</li>
                  <li>Secure API communication</li>
                  <li>Infrastructure monitoring and logging</li>
                  <li>Rate limiting and abuse prevention mechanisms</li>
                  <li>Security updates and vulnerability management</li>
                  <li>Access restrictions for internal systems</li>
                </ul>
                <p>
                  While we strive to protect personal information, no method of transmission or storage can be guaranteed to be completely secure. Users acknowledge and accept that no system is entirely immune from security risks. In the event of a security incident affecting personal information, Rovvy may provide notifications as required by applicable law.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 9 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">09.</span> Cookies and Similar Technologies
              </h2>
              <p className="mb-5">
                Rovvy uses cookies, local storage technologies, session identifiers, and similar technologies to operate and improve the Service. Cookies are small text files stored on a device that help websites and applications function efficiently.
              </p>

              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Essential Cookies</h3>
                  <p className="mb-2">Required for the operation of the Service, including:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Authentication cookies</li>
                    <li>Session management</li>
                    <li>Security features</li>
                    <li>Login persistence</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Functional Cookies</h3>
                  <p className="mb-2">Used to remember user preferences and improve experiences, such as:</p>
                  <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                    <li>Language preferences</li>
                    <li>Interface settings</li>
                    <li>Saved preferences</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#0F172A" }}>Analytics Cookies</h3>
                  <p>
                    Rovvy may use limited analytics technologies to understand platform usage, monitor performance, improve features, and diagnose technical issues.
                  </p>
                </div>
              </div>

              <p
                className="mt-5 rounded-lg p-4 text-sm font-medium"
                style={{ background: "#F0FDFA", border: "1px solid #99F6E4", color: "#0F766E" }}
              >
                Rovvy does not use advertising cookies or sell personal information to advertising networks.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 10 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">10.</span> Your Privacy Rights
              </h2>
              <p className="mb-5">
                Depending on your jurisdiction, you may have certain rights regarding your personal information.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { right: "Right to Access", desc: "Request access to personal information we maintain about you." },
                  { right: "Right to Correction", desc: "Request correction of inaccurate or incomplete information." },
                  { right: "Right to Deletion", desc: "Request deletion of personal information subject to legal exceptions." },
                  { right: "Right to Data Portability", desc: "Request a copy of certain information in a portable format where required by law." },
                  { right: "Right to Restrict Processing", desc: "Request restrictions on certain processing activities where permitted by law." },
                  { right: "Right to Withdraw Consent", desc: "Where processing is based on consent, withdraw consent at any time." },
                  { right: "Right to Object", desc: "Object to certain processing activities, including processing based on legitimate interests." },
                ].map(({ right, desc }) => (
                  <div
                    key={right}
                    className="rounded-lg p-4"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <p className="font-semibold text-sm mb-1" style={{ color: "#0F766E" }}>{right}</p>
                    <p className="text-sm" style={{ color: "#4B5563" }}>{desc}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm" style={{ color: "#6B7280" }}>
                Users may exercise privacy rights through account settings or by contacting Rovvy. Rovvy may verify requests before processing them to protect user privacy and security.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 11 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">11.</span> California Privacy Rights
              </h2>
              <div className="space-y-3">
                <p>
                  Residents of California may have additional rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA). California residents may have rights to:
                </p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Know what personal information is collected</li>
                  <li>Request deletion of personal information</li>
                  <li>Correct inaccurate information</li>
                  <li>Access categories of data shared or disclosed</li>
                  <li>Limit use of sensitive personal information where applicable</li>
                </ul>
                <p>
                  Rovvy does not sell personal information as defined under applicable California law. Rovvy does not knowingly share personal information for cross-context behavioral advertising. Users will not be discriminated against for exercising privacy rights.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 12 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">12.</span> International Data Transfers
              </h2>
              <p>
                Rovvy operates primarily from the United States and may process information in the United States or other jurisdictions where Rovvy or its service providers operate. Users accessing the Service from outside the United States acknowledge that information may be transferred to countries with data protection laws that differ from those of their jurisdiction. Where required by law, Rovvy implements safeguards designed to protect international data transfers. By using the Service, users consent to such transfers where permitted by applicable law.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 13 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">13.</span> Children's Privacy
              </h2>
              <p>
                Rovvy is not directed toward individuals under the age of eighteen (18). We do not knowingly collect personal information from children or minors. If Rovvy becomes aware that personal information has been collected from a person under eighteen in violation of this Policy, we may take steps to remove such information and terminate associated accounts. Parents or guardians who believe a minor has provided information to Rovvy may contact us to request review or deletion.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 14 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">14.</span> Changes to This Privacy Policy
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy may update or modify this Privacy Policy from time to time to reflect changes in legal requirements, technology, business practices, or Service features.
                </p>
                <p>Material changes may be communicated through email notifications, in-app messages, website notices, or other reasonable means of communication. Where required by law, Rovvy will provide advance notice before changes become effective.</p>
                <p>
                  Continued use of the Service after the effective date of an updated Privacy Policy constitutes acknowledgment of the revised Policy.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 15 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">15.</span> Contact Information
              </h2>
              <p className="mb-4">If you have questions regarding this Privacy Policy or wish to exercise privacy rights, please contact us:</p>

              <div
                className="rounded-lg p-5 space-y-1 text-sm mb-4"
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

              <p className="text-sm" style={{ color: "#6B7280" }}>
                Users may also contact us regarding data access requests, account deletion requests, privacy concerns, security issues, and regulatory inquiries. Rovvy is committed to addressing privacy concerns in a timely and transparent manner.
              </p>
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
