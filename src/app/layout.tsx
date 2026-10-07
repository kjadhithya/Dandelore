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
      // The inline script below sets --boot-bg on <html> before React hydrates.
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${spectral.variable} ${inter.variable} ${lora.variable}`}
    >
      <head>
        {/* Paint the remembered theme's background before the app loads, so a
            Dark-theme user doesn't see a flash of the light default first.
            Colors match THEME_BG in src/lib/theme/tokens.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("kv-theme");var c={"Light":"#f7f7f7","Light Warm":"#faf7f2","Dark":"#141414","Dark Warm":"#15130f"}[t];if(c)document.documentElement.style.setProperty("--boot-bg",c)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
