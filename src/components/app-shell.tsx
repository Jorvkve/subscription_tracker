import Link from "next/link";
import { signOut } from "@/auth";
import {
  CalendarDotsIcon,
  ClockCounterClockwiseIcon,
  ListBulletsIcon,
  ReceiptIcon,
  SignOutIcon,
  SquaresFourIcon,
} from "@/components/icons";

type ActivePage = "overview" | "subscriptions" | "schedule" | "slips" | "activity";

const navItems = [
  { key: "overview", href: "/", label: "ภาพรวม", shortLabel: "ภาพรวม", Icon: SquaresFourIcon },
  { key: "subscriptions", href: "/subscriptions", label: "รายการ Subscription", shortLabel: "รายการ", Icon: ListBulletsIcon },
  { key: "schedule", href: "/schedule", label: "ตารางงาน", shortLabel: "ตารางงาน", Icon: CalendarDotsIcon },
  { key: "slips", href: "/slips", label: "สลิปค่าใช้จ่าย", shortLabel: "สลิป", Icon: ReceiptIcon },
  { key: "activity", href: "/activity", label: "ประวัติและระบบ", shortLabel: "ประวัติ", Icon: ClockCounterClockwiseIcon },
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
          <span className="brand-mark">S</span>
          <span><strong>Subtrack</strong><small>PERSONAL FINANCE</small></span>
        </Link>
        <p className="nav-caption">เมนูหลัก</p>
        <nav className="side-nav" aria-label="เมนูหลัก">
          {navItems.map(({ key, href, label, shortLabel, Icon }) => (
            <Link
              className={active === key ? "nav-link active" : "nav-link"}
              href={href}
              aria-current={active === key ? "page" : undefined}
              key={key}
            >
              <span className="nav-icon"><Icon aria-hidden /></span>
              <span className="nav-label-full">{label}</span>
              <span className="nav-label-short">{shortLabel}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-chip"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="account-email">{email}</span></div>
          <form action={signOutAction}>
            <button className="nav-link signout" type="submit"><span className="nav-icon"><SignOutIcon aria-hidden /></span> ออกจากระบบ</button>
          </form>
        </div>
      </aside>
      <main className="main-area" id="main-content">
        <div className="mobile-brand">
          <span className="brand-mark">S</span>
          <strong>Subtrack</strong>
          <form action={signOutAction} className="mobile-signout-form">
            <button className="mobile-signout" type="submit" aria-label="ออกจากระบบ" title="ออกจากระบบ"><SignOutIcon aria-hidden /></button>
          </form>
        </div>
        {children}
      </main>
    </div>
  );
}
