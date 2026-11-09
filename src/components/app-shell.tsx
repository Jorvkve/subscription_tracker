import Link from "next/link";
import { signOut } from "@/auth";
import {
  CalendarDotsIcon,
  ClockCounterClockwiseIcon,
  GiftIcon,
  ListBulletsIcon,
  ReceiptIcon,
  SignOutIcon,
  SquaresFourIcon,
  TargetIcon,
} from "@/components/icons";

type ActivePage = "overview" | "subscriptions" | "schedule" | "slips" | "goals" | "perks" | "activity";

const navItems = [
  { key: "overview", href: "/", label: "ภาพรวม", shortLabel: "ภาพรวม", Icon: SquaresFourIcon, tone: "lime" },
  { key: "slips", href: "/slips", label: "Money Tracker", shortLabel: "รายจ่าย", Icon: ReceiptIcon, tone: "yellow" },
  { key: "subscriptions", href: "/subscriptions", label: "Subs", shortLabel: "Subs", Icon: ListBulletsIcon, tone: "purple" },
  { key: "schedule", href: "/schedule", label: "ตารางงาน & กะ", shortLabel: "ตารางงาน", Icon: CalendarDotsIcon, tone: "pink" },
  // Placeholders for now; the phone bottom bar keeps its five items.
  { key: "goals", href: "/goals", label: "เป้าหมายการออม", shortLabel: "Goals", Icon: TargetIcon, tone: "red", desktopOnly: true },
  { key: "perks", href: "/perks", label: "สิทธิพิเศษ", shortLabel: "Perks", Icon: GiftIcon, tone: "orange", desktopOnly: true },
  { key: "activity", href: "/activity", label: "ประวัติและระบบ", shortLabel: "ประวัติ", Icon: ClockCounterClockwiseIcon, tone: "blue" },
] as const;

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/signin" });
}

export function AppShell({
  children,
  email,
  active = "overview",
}: {
  children: React.ReactNode;
  email: string;
  active?: ActivePage;
}) {
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden>$</span>
          <span><strong className="brand-name">SUBTRACK</strong><small>PERSONAL FINANCE</small></span>
        </Link>
        <p className="nav-caption">เมนูหลัก</p>
        <nav className="side-nav" aria-label="เมนูหลัก">
          {navItems.map((item) => {
            const { key, href, label, shortLabel, Icon, tone } = item;
            const desktopOnly = "desktopOnly" in item && item.desktopOnly;
            return (
            <Link
              className={`nav-link${active === key ? " active" : ""}${desktopOnly ? " nav-desktop-only" : ""}`}
              href={href}
              aria-current={active === key ? "page" : undefined}
              key={key}
            >
              <span className={`nav-icon tone-${tone}`}><Icon aria-hidden weight="duotone" /></span>
              <span className="nav-label-full">{label}</span>
              <span className="nav-label-short">{shortLabel}</span>
            </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-chip"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="account-text"><strong>เจ้าของบัญชี</strong><span className="account-email">{email}</span></span></div>
          <form action={signOutAction}>
            <button className="nav-link signout" type="submit"><span className="nav-icon"><SignOutIcon aria-hidden /></span> ออกจากระบบ</button>
          </form>
        </div>
      </aside>
      <main className="main-area" id="main-content">
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden>$</span>
          <strong className="brand-name">SUBTRACK</strong>
          <form action={signOutAction} className="mobile-signout-form">
            <button className="mobile-signout" type="submit" aria-label="ออกจากระบบ" title="ออกจากระบบ"><SignOutIcon aria-hidden /></button>
          </form>
        </div>
        {children}
      </main>
    </div>
  );
}
