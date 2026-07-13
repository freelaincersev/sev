import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

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
  // TODO(Day16): replace with the real production domain at deploy time.
  metadataBase: new URL("https://sev.app"),
  title: {
    template: "%s | Sev",
    default: "Sev — Your AI memory, owned by you",
  },
  // Must match the landing hero copy in app/page.tsx (SEO "본문 일치").
  description:
    "Sev turns your files, notes, links, and documents into a portable AI memory layer for you and your team — so ChatGPT, Claude, Gemini, and Cursor can work with the context you already own.",
  // Landing is bilingual (en + ko). True hreflang (alternates.languages) is
  // deferred until real /en·/ko routes exist (i18n routing, Day16) — pointing
  // hreflang at non-existent URLs would be worse than none.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sev.app",
    siteName: "Sev",
    // images: add a 1200x630 og-image with alt text once the asset exists.
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
        <Toaster />
      </body>
    </html>
  );
}
