import Link from "next/link";
import { signOut } from "@/auth";

export function AppShell({
  children,
  email,
  active = "overview",
}: {
  children: React.ReactNode;
  email: string;
  active?: "overview" | "subscriptions" | "activity";
}) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">S</span>
          <span><strong>Subtrack</strong><small>PERSONAL FINANCE</small></span>
        </Link>
        <p className="nav-caption">เมนูหลัก</p>
        <nav className="side-nav" aria-label="เมนูหลัก">
          <Link className={active === "overview" ? "nav-link active" : "nav-link"} href="/">
            <span className="nav-icon">◫</span> ภาพรวม
          </Link>
          <Link className={active === "subscriptions" ? "nav-link active" : "nav-link"} href="/subscriptions">
            <span className="nav-icon">▤</span> รายการ Subscription
          </Link>
          <Link className={active === "activity" ? "nav-link active" : "nav-link"} href="/activity">
            <span className="nav-icon">◷</span> ประวัติและระบบ
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="account-chip"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="account-email">{email}</span></div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/signin" }); }}>
            <button className="nav-link signout" type="submit"><span className="nav-icon">↪</span> ออกจากระบบ</button>
          </form>
        </div>
      </aside>
      <main className="main-area">
        <div className="mobile-brand"><span className="brand-mark">S</span><strong>Subtrack</strong></div>
        {children}
      </main>
    </div>
  );
}
