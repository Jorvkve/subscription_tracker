import Link from "next/link";
import { signOut } from "@/auth";
import { NavLinks } from "@/components/nav-links";
import { SignOutIcon } from "@/components/icons";
import { CollapsibleLayout, SidebarToggle } from "@/components/sidebar-state";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/signin" });
}

/** The sidebar, phone bar, and main area, drawn once by the (app) layout for every page. */
export function AppShell({
  children,
  email,
  sidebarCollapsed = false,
  badges = {},
}: {
  children: React.ReactNode;
  email: string;
  sidebarCollapsed?: boolean;
  /** Counts shown next to menu items, keyed by href. Zero shows nothing. */
  badges?: Record<string, number>;
}) {
  return (
    <CollapsibleLayout initialCollapsed={sidebarCollapsed}>
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
      <aside className="sidebar">
        <Link className="brand" href="/" title="SUBTRACK">
          <span className="brand-mark" aria-hidden>$</span>
          <span className="brand-text"><strong className="brand-name">SUBTRACK</strong><small>PERSONAL FINANCE</small></span>
        </Link>
        <p className="nav-caption">เมนูหลัก</p>
        <NavLinks badges={badges} />
        <div className="sidebar-bottom">
          <p className="nav-caption">บัญชี</p>
          <div className="account-chip" title={email}><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="account-text"><strong>เจ้าของบัญชี</strong><span className="account-email">{email}</span></span></div>
          <form action={signOutAction}>
            <button className="nav-link signout" type="submit" title="ออกจากระบบ"><span className="nav-icon"><SignOutIcon aria-hidden /></span><span className="nav-label-full">ออกจากระบบ</span></button>
          </form>
          <SidebarToggle />
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
    </CollapsibleLayout>
  );
}
