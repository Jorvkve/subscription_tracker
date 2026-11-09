import type { ReactNode } from "react";
import { appDateString, appTimeString, utcDate } from "@/lib/dates";

/** Page title with a lime accent word, plus the date, time and a friendly line on the right. */
export function HeroHeader({
  title,
  accent,
  name,
  tagline,
  children,
}: {
  title: string;
  accent?: string;
  name: string;
  tagline: string;
  children?: ReactNode;
}) {
  const date = new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate(appDateString()));
  return (
    <header className="page-header hero-header">
      <div>
        <h1 className="hero-title">{title}{accent && <> <span className="hero-accent">{accent}</span></>}</h1>
        {children && <div className="hero-actions">{children}</div>}
      </div>
      <div className="hero-meta">
        <p className="header-clock">{date}<span> · {appTimeString()} น.</span></p>
        <p className="hero-tagline">เฮ้ <span className="greeting-name">{name}</span>! {tagline}</p>
      </div>
    </header>
  );
}

export function firstName(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim().split(/\s+/)[0] || user.email?.split("@")[0] || "คุณ";
}
