import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Outfit } from "next/font/google";
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
  title: "Rovvy — Roam together",
  description:
    "Group travel coordination. Plan trips, coordinate live, split expenses.",
  keywords: [
    "group travel",
    "trip planning",
    "travel coordination",
    "expense splitting",
  ],
  openGraph: {
    title: "Rovvy — Roam together",
    description: "Group travel made simple.",
    siteName: "Rovvy",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/logo-icon.png", type: "image/png" }],
    apple: [{ url: "/logo-icon.png", sizes: "512x512", type: "image/png" }],
  },
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
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Script id="gt-register-sw" strategy="afterInteractive">
          {`
            if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
              navigator.serviceWorker.register("/sw.js")
                .then(function (reg) { console.log("SW registered:", reg.scope); })
                .catch(function (err) { console.log("SW error:", err); });
            }
          `}
        </Script>
        <Script
          id="travelpayouts-drive"
          src="https://tpembars.com/NTI4MDky.js?t=528092"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
