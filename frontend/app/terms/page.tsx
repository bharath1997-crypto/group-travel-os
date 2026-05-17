"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function TermsPage() {
  const [reachedBottom, setReachedBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    // Check if already read
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
    localStorage.setItem("rovvy_terms_read", "true");
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
            Legal Agreement
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Last Updated: May 2026 • Version 1.1
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-[#94A3B8] font-normal">
          <p className="text-base text-[#E2E8F0]">
            Welcome to <strong className="text-[#CCFBF1]">Rovvy</strong> ("we," "us," or "our"). By accessing or using our website, services, mobile application, and related software (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). Please read them carefully.
          </p>

          <hr className="border-[#1E293B]" />

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">01.</span> Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Service, you signify your agreement to these Terms. If you do not agree to these Terms, you may not access or use the Service. These Terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">02.</span> Description of Service
            </h2>
            <p>
              Rovvy provides a collaborative digital platform designed to facilitate group travel planning and coordination. The Service includes features such as flight and hotel discovery, itinerary building, routing, bus search, shared travel hubs, group voting, real-time messaging, collaborative budget tracking, expense splitting, and opt-in live location sharing during active trips.
            </p>
            <p>
              Please note that while Rovvy helps you plan, discover, and organize your trips, we are not a travel agency, hotelier, common carrier, or booking operator. All reservations and payments made for travel-related goods or services are made directly with third-party service providers and are subject to their respective terms and conditions.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">03.</span> User Accounts and Registration
            </h2>
            <p>
              To use certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
            </p>
            <p>
              You are responsible for safeguarding your account credentials, including passwords or third-party OAuth access tokens (e.g., Google login tokens). You agree not to disclose your password to any third party and to take sole responsibility for any activities or actions under your account, whether or not you have authorized such activities or actions. You must immediately notify us of any unauthorized use of your account.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">04.</span> User Conduct
            </h2>
            <p>
              You agree to use the Service in compliance with all applicable local, state, national, and international laws, rules, and regulations. You shall not:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Use the Service for any unlawful or fraudulent purpose.</li>
              <li>Impersonate any person or entity or falsely state your affiliation with a person or entity.</li>
              <li>Harass, abuse, threaten, or defame other members of your group or any other user.</li>
              <li>Upload, transmit, or distribute any content that contains software viruses, malware, or any code designed to disrupt, damage, or limit the functioning of the Service.</li>
              <li>Interfere with or disrupt the servers, networks, or databases connected to the Service.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or other user accounts.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">05.</span> Privacy and Data
            </h2>
            <p>
              Your privacy is of the utmost importance to us. Our collection, storage, and use of your personal data, profile info, and live telemetry (such as location sharing) are governed strictly by our Privacy Policy. By agreeing to these Terms, you also acknowledge and agree to the terms of our Privacy Policy.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">06.</span> Intellectual Property
            </h2>
            <p>
              The Service, including its original content, features, layout, brand styling, logos, iconography, database schemas, codebases, and assets are and will remain the exclusive property of Rovvy and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">07.</span> Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall Rovvy, its affiliates, directors, employees, or partners be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any travel arrangements or experiences organized through the Service; or (iv) unauthorized access, use, or alteration of your transmissions or content.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">08.</span> Termination
            </h2>
            <p>
              We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever, including without limitation a breach of these Terms.
            </p>
            <p>
              If you wish to terminate your account, you may simply discontinue using the Service or request account deletion via the support desk.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">09.</span> Changes to Terms
            </h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
              <span className="text-[#0F766E] text-base font-mono">10.</span> Contact Information
            </h2>
            <p>
              If you have any questions or concerns regarding these Terms, please contact our legal and support team at:
            </p>
            <p className="font-semibold text-[#CCFBF1]">
              Email: support@rovvy.app
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
                ? "Please scroll to the bottom of the page to read and unlock terms."
                : accepted 
                  ? "You've successfully acknowledged the Terms of Service."
                  : "You've read the terms. You can now agree to unlock registration."}
            </p>
          </div>
          
          {accepted ? (
            <div className="flex h-10 items-center gap-2 rounded-lg bg-[#0F766E]/20 px-5 text-sm font-semibold text-[#5EEAD4] border border-[#0F766E]/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Terms Acknowledged
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
              I have read the Terms
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
