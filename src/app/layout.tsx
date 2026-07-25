import type { Metadata } from "next";
import localFont from "next/font/local";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

/*
 * Fonts are SELF-HOSTED via `next/font/local` (design D6). `next/font/google`
 * is deliberately not used: it downloads at build time, which would add a
 * network vertex to a build that must succeed offline and without a database
 * (INV-8). The `.woff2` binaries under `./fonts/` enter the repo as source
 * assets, with their OFL licences alongside; Next emits them into
 * `.next/static/media`, which the Dockerfile already copies.
 *
 * Both files are the variable, latin-subset builds (U+0000-00FF plus general
 * punctuation), which covers every glyph Spanish copy needs. Decorative
 * glyphs outside that range (arrows, stars, check marks) are NOT covered —
 * later phases must draw those as SVG icons rather than as text.
 */
const display = localFont({
  src: "./fonts/BricolageGrotesque-Variable-latin.woff2",
  variable: "--font-display",
  weight: "400 800",
  style: "normal",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const body = localFont({
  src: "./fonts/HankenGrotesk-Variable-latin.woff2",
  variable: "--font-body",
  weight: "400 700",
  style: "normal",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Rodak",
    template: "%s | Rodak",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
