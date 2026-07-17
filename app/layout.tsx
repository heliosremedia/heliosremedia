import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { getSiteUrl } from "@/lib/site";

import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Helios Real Estate Media",
  description:
    "Luxury real estate photography, cinematic films, and branding for Northern Colorado's finest homes.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Helios Real Estate Media",
    title: "Helios Real Estate Media",
    description:
      "Luxury real estate photography, cinematic films, and branding for Northern Colorado's finest homes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${inter.variable}`}>
        {children}
      </body>
    </html>
  );
}
