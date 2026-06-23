import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Outfit } from "next/font/google";
import { ClientProviders } from "./client-providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: {
    default: 'Rovvy — Roam together',
    template: '%s | Rovvy',
  },
  description: 'Group travel coordination. Plan trips, coordinate live, split expenses.',
  applicationName: 'Rovvy',
  keywords: ['group travel', 'trip planning', 'travel coordination', 'expense splitting'],
  openGraph: {
    title: 'Rovvy — Roam together',
    description: 'Group travel made simple.',
    siteName: 'Rovvy',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Rovvy — Roam together',
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <Script id="rovvy-api-rejection-guard" strategy="beforeInteractive">
          {`(function(){if(typeof window==="undefined")return;var k="__rovvyApiRejectionGuardInline";if(window[k])return;window[k]=true;window.addEventListener("unhandledrejection",function(e){var r=e.reason;var m=r&&r.message?r.message:String(r||"");if(/timed out|database might be waking|Failed to fetch|Network error|Could not reach|rovvyApiUnavailable/i.test(m)||(r&&r.rovvyApiUnavailable)){e.preventDefault();console.warn("[Rovvy] API unavailable:",m);}},true);})();`}
        </Script>
        <ClientProviders>{children}</ClientProviders>
        <Script id="gt-register-sw" strategy="afterInteractive">
          {`
            if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
              navigator.serviceWorker.register("/sw.js")
                .then(function (reg) { console.log("SW registered:", reg.scope); })
                .catch(function (err) { console.log("SW error:", err); });
            }
          `}
        </Script>
        {process.env.NODE_ENV === "production" && (
          <Script
            id="travelpayouts-drive"
            src="https://tpembars.com/NTI4MDky.js?t=528092"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
