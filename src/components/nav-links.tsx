"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDotsIcon,
  ClockCounterClockwiseIcon,
  GiftIcon,
  ListBulletsIcon,
  ReceiptIcon,
  SquaresFourIcon,
  TargetIcon,
} from "@/components/icons";
import { useSidebar } from "@/components/sidebar-state";

const navItems = [
  { href: "/", label: "ภาพรวม", shortLabel: "ภาพรวม", Icon: SquaresFourIcon, tone: "lime" },
  { href: "/slips", label: "Money Tracker", shortLabel: "รายจ่าย", Icon: ReceiptIcon, tone: "yellow" },
  { href: "/subscriptions", label: "Subs", shortLabel: "Subs", Icon: ListBulletsIcon, tone: "purple" },
  { href: "/schedule", label: "ตารางงาน & กะ", shortLabel: "ตารางงาน", Icon: CalendarDotsIcon, tone: "pink" },
  // Placeholders for now; the phone bottom bar keeps its five items.
  { href: "/goals", label: "เป้าหมายการออม", shortLabel: "Goals", Icon: TargetIcon, tone: "red", desktopOnly: true },
  { href: "/perks", label: "สิทธิพิเศษ", shortLabel: "Perks", Icon: GiftIcon, tone: "orange", desktopOnly: true },
  { href: "/activity", label: "ประวัติและระบบ", shortLabel: "ประวัติ", Icon: ClockCounterClockwiseIcon, tone: "blue" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The menu lives in the shared layout, so it stays on screen between pages. It reads the
 * active tab from the URL, which updates the highlight as soon as a link is tapped.
 */
export function NavLinks({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  return (
    <nav className="side-nav" aria-label="เมนูหลัก">
      {navItems.map((item) => {
        const { href, label, shortLabel, Icon, tone } = item;
        const active = isActive(pathname, href);
        const desktopOnly = "desktopOnly" in item && item.desktopOnly;
        const badge = badges[href] ?? 0;
        return (
          <Link
            className={`nav-link${active ? " active" : ""}${desktopOnly ? " nav-desktop-only" : ""}`}
            href={href}
            aria-current={active ? "page" : undefined}
            key={href}
            title={collapsed ? (badge > 0 ? `${label} (${badge})` : label) : undefined}
          >
            <span className={`nav-icon tone-${tone}`}><Icon aria-hidden weight="duotone" /></span>
            <span className="nav-label-full">{label}</span>
            <span className="nav-label-short">{shortLabel}</span>
            {badge > 0 && (
              <span className="nav-badge" aria-label={`ใกล้ครบกำหนด ${badge} รายการ`}>{badge > 9 ? "9+" : badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
