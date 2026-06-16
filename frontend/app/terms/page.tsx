"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";
import { SettingsBreadcrumb, legalCrumbs } from "@/components/settings/SettingsBreadcrumb";

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
        <SettingsBreadcrumb crumbs={legalCrumbs("Terms of Service")} />
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
              Terms of Service
            </h1>
            <p className="mt-3 text-base" style={{ color: "#6B7280", lineHeight: "1.8" }}>
              Please read these terms carefully before using Rovvy. By using the Service you agree to be bound by them.
            </p>
          </div>

          <div className="space-y-10" style={{ fontSize: "15px", lineHeight: "1.8", color: "#374151" }}>

            {/* 1 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">01.</span> Acceptance of Terms
              </h2>
              <div className="space-y-3">
                <p>
                  Welcome to Rovvy. These Terms of Service ("Terms") constitute a legally binding agreement between you and Rovvy ("Rovvy," "we," "us," or "our") governing your access to and use of the Rovvy platform, including our website, mobile applications, APIs, software, content, communications, and related services (collectively, the "Service").
                </p>
                <p>
                  By accessing, browsing, registering for an account, downloading, or otherwise using the Service, you acknowledge that you have read, understood, and agreed to be bound by these Terms, as well as any additional policies, guidelines, or supplemental terms that may apply to specific features of the Service. If you do not agree to these Terms, you must immediately discontinue use of the Service.
                </p>
                <p>
                  Rovvy is a travel coordination and social platform designed to help individuals and groups discover destinations, organize trips, coordinate travel experiences, communicate with fellow travelers, share locations, track expenses, and access travel-related information and services. Certain features may be subject to additional terms or conditions, which shall become part of these Terms upon publication or acceptance.
                </p>
                <p>
                  These Terms apply to all users of the Service, including visitors, registered users, trip organizers, group members, contributors, and any other individuals who access or use the platform in any capacity.
                </p>
                <p>
                  You represent and warrant that you have the legal authority and capacity to enter into this agreement and that your use of the Service complies with all applicable laws, regulations, and legal obligations in your jurisdiction. If you are using the Service on behalf of an organization, company, or other legal entity, you further represent and warrant that you have the authority to bind such entity to these Terms, in which case references to "you" include both the individual user and the entity.
                </p>
                <p>
                  Rovvy reserves the right to modify, suspend, discontinue, or update any aspect of the Service at any time, with or without notice. Continued use of the Service following any modification to these Terms or the Service constitutes your acceptance of such modifications.
                </p>
                <p>
                  In the event that any provision of these Terms is determined to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect to the maximum extent permitted by law.
                </p>
                <p>
                  These Terms constitute the entire agreement between you and Rovvy concerning the Service and supersede any prior agreements, communications, or understandings, whether written or oral, relating to the subject matter herein.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 2 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">02.</span> Description of the Service
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy is a technology platform that enables users to plan, organize, and experience travel individually or collaboratively. The Service is designed to simplify travel coordination among friends, families, colleagues, and communities by providing tools that facilitate communication, planning, discovery, and real-time collaboration.
                </p>
                <p>Features and functionality of the Service may include, but are not limited to:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>Group trip creation and management</li>
                  <li>Collaborative itinerary planning</li>
                  <li>Trip invitations and member management</li>
                  <li>Real-time location sharing through Trip LIVE</li>
                  <li>Group messaging and communication features</li>
                  <li>Activity and event discovery</li>
                  <li>Polling and collaborative decision-making tools</li>
                  <li>Shared expense tracking and settlement assistance</li>
                  <li>AI-powered travel recommendations and assistance</li>
                  <li>Maps, navigation, and travel insights</li>
                  <li>Integration with third-party booking providers and affiliate partners</li>
                </ul>
                <p>
                  The availability of specific features may vary based on geographic region, device compatibility, subscription status, or technical limitations. Rovvy reserves the right to introduce, modify, restrict, or remove features at its sole discretion.
                </p>
                <p>
                  Rovvy operates solely as a technology and coordination platform. Rovvy does not own, operate, provide, manage, or control transportation services, lodging providers, tour operators, event organizers, insurance providers, or financial institutions. Rovvy is not a travel agency, travel broker, booking operator, or seller of travel services unless expressly stated otherwise.
                </p>
                <p>
                  Any reservations, purchases, bookings, or transactions conducted through third-party services are entered into directly between you and the applicable provider. Rovvy is not responsible for the quality, safety, legality, accuracy, availability, pricing, cancellation policies, or fulfillment of third-party products or services.
                </p>
                <p>
                  Users acknowledge that travel inherently involves risks, including but not limited to transportation disruptions, weather events, accidents, health concerns, regulatory restrictions, political events, and unforeseen circumstances. Users are solely responsible for assessing risks associated with travel and making informed decisions regarding their activities.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 3 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">03.</span> Eligibility and Age Requirements
              </h2>
              <div className="space-y-3">
                <p>
                  The Service is intended exclusively for users who are at least eighteen (18) years of age. By creating an account or using the Service, you represent and warrant that you are at least eighteen years old and possess the legal capacity to enter into binding agreements under applicable law.
                </p>
                <p>
                  You are solely responsible for ensuring that your use of the Service complies with all laws and regulations applicable in your country, state, province, or locality.
                </p>
                <p>
                  Rovvy does not knowingly permit individuals under the age of eighteen to create accounts or use the Service. If Rovvy becomes aware that an account has been created by an underage individual, we reserve the right to suspend or terminate such account and remove associated information, subject to applicable law.
                </p>
                <p>Users may not use the Service if they have previously been suspended or removed from the platform unless expressly authorized by Rovvy.</p>
                <p>You further represent and warrant that:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "lower-alpha" }}>
                  <li>you are not prohibited from using the Service under any applicable law or regulation;</li>
                  <li>your use of the Service does not violate sanctions, export control laws, or other legal restrictions; and</li>
                  <li>all information you provide to Rovvy is accurate, complete, and current.</li>
                </ul>
                <p>Any misrepresentation regarding age, identity, or legal eligibility may result in immediate account suspension or termination.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 4 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">04.</span> User Accounts and Authentication
              </h2>
              <div className="space-y-3">
                <p>
                  Access to certain features of Rovvy may require the creation of a user account. You agree to provide accurate, current, and complete information during registration and to maintain the accuracy of such information throughout your use of the Service.
                </p>
                <p>
                  Users may register through email authentication, social login providers, or other authentication methods supported by Rovvy. By using third-party authentication services, you acknowledge that additional terms and privacy policies of those providers may apply.
                </p>
                <p>
                  You are solely responsible for safeguarding your account credentials, passwords, authentication methods, and devices used to access the Service. You agree not to disclose your credentials to any third party or permit unauthorized access to your account.
                </p>
                <p>
                  You accept full responsibility for all activities occurring under your account, whether or not such activities were authorized by you. If you suspect unauthorized access, loss of credentials, or any security incident affecting your account, you must notify Rovvy immediately.
                </p>
                <p>We may suspend, restrict, or terminate accounts that:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>violate these Terms</li>
                  <li>engage in fraudulent or abusive conduct</li>
                  <li>compromise platform security</li>
                  <li>impersonate others</li>
                  <li>create risk or liability for Rovvy or its users</li>
                </ul>
                <p>
                  Account termination may result in loss of access to trips, messages, content, location history, or other user data, subject to applicable law and our data retention practices. Users remain responsible for any obligations or liabilities arising prior to account termination.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 5 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">05.</span> Trip LIVE and Location Services
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy provides location-based features designed to facilitate travel coordination, group awareness, and trip experiences. These features may include real-time location sharing, map displays, route visualization, proximity alerts, and Trip LIVE functionality.
                </p>
                <p>
                  Location services require explicit user permission through device settings or application controls. Users may enable or disable location access at any time; however, certain features may become unavailable or function with reduced capabilities when location access is disabled.
                </p>
                <p>Users acknowledge and agree that:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>GPS technology may be inaccurate or delayed</li>
                  <li>location data may not be continuously available</li>
                  <li>connectivity issues may impact updates</li>
                  <li>third-party map providers may influence displayed information</li>
                  <li>location sharing may expose travel patterns or presence information to authorized trip participants</li>
                </ul>
                <p>
                  Trip LIVE and related features are provided solely for convenience and coordination purposes. Rovvy is not an emergency service, dispatch provider, rescue organization, or public safety system. Users must not rely on Rovvy for emergency response, medical assistance, rescue operations, or safety monitoring. In emergencies, users should immediately contact local emergency services.
                </p>
                <p>
                  Rovvy shall not be liable for damages, losses, injuries, or claims arising from inaccurate location information, delayed updates, unauthorized sharing, or user reliance on location-based features.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 6 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">06.</span> User Content and Content License
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy allows users to create, upload, submit, transmit, store, and share various forms of content through the Service, including but not limited to text, messages, photos, videos, itineraries, trip details, reviews, comments, expense information, profile information, location data, event information, and other materials (collectively, "User Content").
                </p>
                <p>
                  You retain ownership of any intellectual property rights you hold in your User Content. By uploading, posting, sharing, or otherwise making User Content available through the Service, you grant Rovvy a worldwide, non-exclusive, royalty-free, transferable, sublicensable license to host, store, reproduce, modify, adapt, publish, display, distribute, transmit, analyze, and process such User Content solely for the purpose of operating, maintaining, securing, improving, and promoting the Service.
                </p>
                <p>You represent and warrant that:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "lower-alpha" }}>
                  <li>you own or have obtained all necessary rights, permissions, and licenses to submit the User Content;</li>
                  <li>your User Content does not infringe any intellectual property rights, privacy rights, publicity rights, or other legal rights of any person or entity;</li>
                  <li>your User Content complies with all applicable laws and regulations; and</li>
                  <li>your User Content does not contain harmful, deceptive, illegal, defamatory, obscene, or offensive material.</li>
                </ul>
                <p>
                  Rovvy reserves the right, but not the obligation, to remove, restrict, edit, or disable access to User Content that violates these Terms or applicable law. Users are solely responsible for backing up their own content.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 7 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">07.</span> Prohibited Conduct
              </h2>
              <p className="mb-3">You agree not to use the Service in a manner that:</p>
              <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                <li>violates any applicable law or regulation</li>
                <li>infringes intellectual property rights</li>
                <li>harasses, threatens, or harms other users</li>
                <li>promotes discrimination, violence, or illegal activities</li>
                <li>distributes malware, viruses, or malicious code</li>
                <li>attempts unauthorized access to systems or accounts</li>
                <li>interferes with platform functionality or security</li>
                <li>scrapes, extracts, or harvests data without permission</li>
                <li>creates fake accounts or impersonates others</li>
                <li>engages in fraud, scams, or deceptive practices</li>
                <li>sends spam or unsolicited communications</li>
                <li>manipulates reviews, ratings, or engagement metrics</li>
                <li>uses bots or automated tools without authorization</li>
              </ul>
              <p className="mt-3">
                Violations may result in warnings, suspension, permanent account termination, reporting to law enforcement, or legal action where appropriate.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 8 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">08.</span> Third-Party Services and Affiliate Links
              </h2>
              <div className="space-y-3">
                <p>
                  The Service may integrate with or provide access to third-party websites, applications, APIs, content providers, map providers, travel services, event providers, booking services, payment processors, and affiliate partners.
                </p>
                <p>
                  Rovvy may earn affiliate commissions or referral fees when users click, purchase, reserve, or book through certain third-party links. Such commissions do not increase the price paid by users unless otherwise disclosed.
                </p>
                <p>Users acknowledge that:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>third-party services operate independently from Rovvy</li>
                  <li>third-party content may change without notice</li>
                  <li>Rovvy does not control third-party policies or practices</li>
                  <li>transactions occur directly between users and providers</li>
                </ul>
                <p>
                  Rovvy is not responsible for pricing discrepancies, booking errors, cancellations, refunds, service interruptions, provider misconduct, travel disruptions, or inaccurate information supplied by third parties. Use of third-party services is subject to their own terms and privacy policies.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 9 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">09.</span> Artificial Intelligence Features
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy may offer AI-powered features and services, including but not limited to travel recommendations, itinerary generation, content summarization, travel insights, assistance tools, and conversational interfaces such as Wayra.
                </p>
                <p>AI-generated outputs are provided solely for informational and convenience purposes. Users acknowledge and agree that:</p>
                <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
                  <li>AI systems may generate inaccurate or incomplete information</li>
                  <li>recommendations may not reflect real-time conditions</li>
                  <li>outputs may contain errors or omissions</li>
                  <li>AI responses should not replace professional advice</li>
                </ul>
                <p>
                  Users are solely responsible for verifying travel information before making decisions or purchases. Rovvy makes no representations or warranties regarding the accuracy, reliability, or suitability of AI-generated outputs.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 10 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">10.</span> User Interactions and Safety
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy enables users to communicate, collaborate, share locations, and participate in travel experiences with others. Users are solely responsible for their interactions with other users, both online and offline.
                </p>
                <p>
                  Rovvy does not conduct background checks, identity verification, or criminal screening of users unless explicitly stated otherwise, and does not guarantee the identity of users, the accuracy of profile information, or the safety of offline interactions.
                </p>
                <p>
                  Users assume all risks associated with meeting others, joining trips, sharing locations, and participating in activities. Users should exercise reasonable caution and judgment when interacting with others.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 11 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">11.</span> Intellectual Property Rights
              </h2>
              <div className="space-y-3">
                <p>
                  The Service and all related content, software, designs, interfaces, logos, trademarks, graphics, databases, and proprietary materials are owned by Rovvy or its licensors and protected under intellectual property laws.
                </p>
                <p>Except as expressly authorized by Rovvy, users may not copy or reproduce the Service, reverse engineer software, create derivative works, distribute proprietary content, or remove copyright notices. Unauthorized use may result in legal action.</p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 12 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">12.</span> Disclaimer of Warranties
              </h2>
              <p
                className="rounded-lg p-4 text-sm font-medium tracking-wide"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#374151" }}
              >
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE MAXIMUM EXTENT PERMITTED BY LAW, ROVVY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. ROVVY DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR THAT CONTENT WILL BE ACCURATE OR COMPLETE. USE OF THE SERVICE IS AT YOUR OWN RISK.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 13 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">13.</span> Limitation of Liability
              </h2>
              <p
                className="rounded-lg p-4 text-sm font-medium tracking-wide"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#374151" }}
              >
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ROVVY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO THE USE OF THE SERVICE, INCLUDING DAMAGES RELATED TO LOSS OF DATA, LOSS OF PROFITS, TRAVEL DISRUPTIONS, MISSED BOOKINGS, PERSONAL INJURY, LOCATION SHARING, USER INTERACTIONS, OR THIRD-PARTY SERVICES. IN NO EVENT SHALL ROVVY'S TOTAL LIABILITY EXCEED THE GREATER OF ONE HUNDRED U.S. DOLLARS (USD $100) OR THE AMOUNT PAID BY YOU TO ROVVY IN THE PRECEDING TWELVE MONTHS.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 14 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">14.</span> Indemnification
              </h2>
              <p>
                You agree to defend, indemnify, and hold harmless Rovvy, its affiliates, officers, directors, employees, contractors, agents, licensors, and partners from and against any claims, damages, liabilities, losses, expenses, costs, and attorneys' fees arising from your use of the Service, your violation of these Terms, your User Content, your interactions with others, or your violation of laws or third-party rights.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 15 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">15.</span> Suspension and Termination
              </h2>
              <div className="space-y-3">
                <p>
                  Rovvy reserves the right to suspend, restrict, disable, or terminate access to the Service at any time and for any reason, including violations of these Terms, security concerns, fraud prevention, or legal compliance.
                </p>
                <p>
                  Users may delete their accounts through available settings or by contacting Rovvy. Termination does not relieve users of obligations incurred prior to termination. Certain provisions of these Terms shall survive termination, including intellectual property rights, limitations of liability, indemnification, and dispute resolution provisions.
                </p>
              </div>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 16 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">16.</span> Governing Law and Dispute Resolution
              </h2>
              <p>
                These Terms shall be governed by the laws of the State of Illinois, United States, without regard to conflict-of-law principles. Any disputes arising out of or relating to these Terms or the Service shall be resolved in the state or federal courts located in Illinois, and users consent to the exclusive jurisdiction and venue of such courts. Nothing in these Terms limits rights that may be available under mandatory consumer protection laws.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 17 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">17.</span> International Users
              </h2>
              <p>
                Rovvy may be accessed from jurisdictions around the world. Users are responsible for ensuring compliance with local laws and regulations applicable to their use of the Service. Users acknowledge that data may be transferred to and processed in the United States or other jurisdictions where Rovvy or its service providers operate. Users are responsible for complying with export control laws, sanctions regulations, and travel restrictions applicable to their location.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 18 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">18.</span> Changes to These Terms
              </h2>
              <p>
                Rovvy may update or modify these Terms from time to time. Material changes may be communicated through email, in-app notifications, website notices, or other reasonable methods. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms. If you do not agree to updated Terms, you must discontinue use of the Service.
              </p>
            </section>

            <hr style={{ borderColor: "#F1F5F9" }} />

            {/* 19 */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#0F766E" }}>
                <span className="font-mono text-sm">19.</span> Contact Information
              </h2>
              <p className="mb-3">For questions, legal notices, or concerns regarding these Terms or the Service, please contact:</p>
              <div
                className="rounded-lg p-5 space-y-1 text-sm"
                style={{ background: "#F0FDFA", border: "1px solid #99F6E4" }}
              >
                <p className="font-semibold" style={{ color: "#0F172A" }}>Rovvy Legal Team</p>
                <p>
                  <span style={{ color: "#6B7280" }}>Email: </span>
                  <a href="mailto:legal@rovvy.app" className="font-medium underline underline-offset-2" style={{ color: "#0F766E" }}>
                    legal@rovvy.app
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
                By using Rovvy, you acknowledge that you have read, understood, and agreed to these Terms of Service.
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
              className="flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold whitespace-nowrap"
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
              className="flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold transition-all whitespace-nowrap"
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
