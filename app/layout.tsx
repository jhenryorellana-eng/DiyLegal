import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/*
 * Tipografías de marca (doc 04 §5). Cabinet Grotesk no está en Google Fonts;
 * se usa su fallback documentado, Plus Jakarta Sans, para el display.
 */
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display-src",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DIY Legal — Tu trámite, en tus manos",
  description:
    "Información oficial de tu caso de inmigración, organizada y en tu idioma. DIY Legal no es un bufete ni brinda asesoría legal.",
  applicationName: "DIY Legal",
};

export const viewport: Viewport = {
  themeColor: "#5B4FE9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
