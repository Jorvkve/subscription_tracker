"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CaretDoubleLeftIcon } from "@/components/icons";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/**
 * Wraps the app layout and remembers whether the desktop sidebar is collapsed. The choice is
 * kept in a cookie, so the server draws the right width on the first paint with no jump.
 */
export function CollapsibleLayout({ initialCollapsed, children }: { initialCollapsed: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <div className="app-layout" data-sidebar={collapsed ? "collapsed" : "open"}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

/** The "hide menu" row at the foot of the desktop sidebar. Phones use the bottom bar instead. */
export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  const label = collapsed ? "ขยายเมนู" : "ย่อเมนู";
  return (
    <button
      className="nav-link sidebar-toggle"
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <span className="nav-icon sidebar-toggle-icon"><CaretDoubleLeftIcon aria-hidden /></span>
      <span className="nav-label-full">{label}</span>
    </button>
  );
}
