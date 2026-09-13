import type { Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0f0f10",
  colorScheme: "dark",
};

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Shared document structure only. Public host data belongs to (public), while
// Studio resolves its current membership in its own layout and endpoints.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${cormorant.variable} ${inter.variable}`}>{children}</body></html>;
}
