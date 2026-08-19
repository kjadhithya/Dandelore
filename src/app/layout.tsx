import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Spectral, Inter, Lora } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Dandelore",
  description: "A personal, cloud-synced knowledge base.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without this, mobile browsers default to "resizes-visual" (or just
  // overlay the keyboard) — the layout viewport, and therefore 100dvh,
  // never actually shrinks when the keyboard opens, so nothing sized with
  // dvh had anything to respond to. This makes the keyboard genuinely
  // resize the page layout instead of just covering the bottom of it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${spectral.variable} ${inter.variable} ${lora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
