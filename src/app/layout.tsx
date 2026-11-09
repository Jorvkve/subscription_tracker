import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Subtrack — Subscription Tracker",
  description: "จัดการ Subscription และค่าใช้จ่ายรายเดือนของคุณ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th" className={sans.variable}><body>{children}</body></html>;
}
