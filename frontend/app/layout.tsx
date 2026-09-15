import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Instrument_Serif, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { ClientProviders } from "./client-providers";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "Rovvy — Roam together",
    template: "%s | Rovvy",
  },
  description: "Group travel coordination. Plan trips, coordinate live, split expenses.",
  applicationName: "Rovvy",
  keywords: ["group travel", "trip planning", "travel coordination", "expense splitting"],
  openGraph: {
    title: "Rovvy — Roam together",
    description: "Group travel made simple.",
    siteName: "Rovvy",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Rovvy — Roam together",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E6E5C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${instrument.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
        {process.env.NODE_ENV === "production" && (
          <Script
            id="gt-register-sw"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
                  navigator.serviceWorker.register("/sw.js")
                    .then(function (reg) { console.log("SW registered:", reg.scope); })
                    .catch(function (err) { console.log("SW error:", err); });
                }
              `,
            }}
          />
        )}
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
