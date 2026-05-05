import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Group Travel OS",
    template: "%s | Group Travel OS",
  },
  description: "Group travel planning, trips, and coordination.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
      </body>
    </html>
  );
}
