import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Subtrack — Subscription Tracker",
  description: "จัดการ Subscription และค่าใช้จ่ายรายเดือนของคุณ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
