import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "@/components/icons";
import { AppShell } from "@/components/app-shell";
import { HeroHeader, firstName } from "@/components/hero-header";
import { SubscriptionSwitch } from "@/components/subscription-switch";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { groupCostTotals } from "@/lib/billing";
import { appDateString, dateOnly, formatDate } from "@/lib/dates";
import { cycleName, dayDifference, money } from "@/lib/display";
import { getPrisma } from "@/lib/prisma";

const shortCycle = { DAY: "วัน", WEEK: "สัปดาห์", MONTH: "เดือน", YEAR: "ปี" } as const;
const COFFEE_THB = 60;

function dueText(delta: number): string {
  if (delta < 0) return `เลยกำหนด ${Math.abs(delta)} วัน`;
  if (delta === 0) return "ตัดวันนี้";
  if (delta === 1) return "ตัดพรุ่งนี้";
  return `อีก ${delta} วัน`;
}

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const today = appDateString();
  const subscriptions = await getPrisma().subscription.findMany({ orderBy: [{ status: "asc" }, { nextDueDate: "asc" }] });

  const active = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE);
  const current = subscriptions.filter((subscription) => subscription.status !== SubscriptionStatus.CANCELED);
  const canceled = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.CANCELED);
  const totals = groupCostTotals(active.map((subscription) => ({
    amount: Number(subscription.price),
    currency: subscription.currency,
    intervalCount: subscription.intervalCount,
    intervalUnit: subscription.intervalUnit,
  })));
  const monthlyThb = totals.THB?.monthly ?? 0;
  const upcoming = [...active].sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime()).slice(0, 3);

  return (
    <AppShell email={session.user.email} active="subscriptions">
      <HeroHeader title="Subs" accent="(Subscription)" name={firstName(session.user)} tagline="คอยดูค่าสมาชิกที่แอบตัดเงินด้วยนะ 👀" />

      <div className="subs-grid">
        <section className="panel" aria-labelledby="burn-title">
          <h2 id="burn-title" className="card-title">ยอดรวมต่อเดือน <span aria-hidden>💸</span></h2>
          {Object.keys(totals).length === 0 ? (
            <strong className="big-number">{money(0, "THB")} <small className="big-number-unit">/ เดือน</small></strong>
          ) : Object.entries(totals).map(([currency, total]) => (
            <strong className="big-number" key={currency}>{money(total.monthly, currency)} <small className="big-number-unit">/ เดือน</small></strong>
          ))}
          <p className="muted dash-line">
            {monthlyThb > 0
              ? <>เท่ากับกาแฟประมาณ {Math.max(1, Math.round(monthlyThb / COFFEE_THB))} แก้ว <span aria-hidden>☕</span> · ปีละ {money(totals.THB.annual, "THB")}</>
              : "ยังไม่มีรายการที่กำลังใช้งาน"}
          </p>
        </section>

        <section className="panel" aria-labelledby="next-pay-title">
          <h2 id="next-pay-title" className="card-title card-title-gap">ใกล้ถึงวันจ่าย <span aria-hidden>📅</span></h2>
          {upcoming.length === 0 ? <p className="empty-note">ไม่มีรายการรอชำระ</p> : (
            <ul className="next-pay-list">
              {upcoming.map((subscription) => {
                const delta = dayDifference(today, dateOnly(subscription.nextDueDate));
                return (
                  <li key={subscription.id}>
                    <Link className={`next-pay ${delta <= 2 ? "next-pay-urgent" : "next-pay-soon"}`} href={`/subscriptions/${subscription.id}`}>
                      <strong>{subscription.name} ({money(Number(subscription.price), subscription.currency)})</strong>
                      <span>{delta <= 2 ? `${dueText(delta)}! 🚨` : `${formatDate(subscription.nextDueDate)} · ${dueText(delta)}`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel subs-cards-panel" aria-labelledby="cards-title">
          <div className="card-heading">
            <h2 id="cards-title" className="card-title">Sub ของคุณ <span aria-hidden>📦</span> <span className="card-title-sub">({current.length} รายการ)</span></h2>
          </div>
          {current.length === 0 ? (
            <div className="empty-note">ยังไม่มี Subscription <Link className="text-link" href="/subscriptions/new">เพิ่มรายการแรกของคุณ <ArrowRightIcon aria-hidden /></Link></div>
          ) : (
            <ul className="sub-cards">
              {current.map((subscription) => {
                const on = subscription.status === SubscriptionStatus.ACTIVE;
                return (
                  <li className={on ? "sub-card" : "sub-card sub-card-off"} key={subscription.id}>
                    <div className="sub-card-top">
                      <span className={`service-avatar avatar-${subscription.name.charCodeAt(0) % 5}`}>{subscription.name.slice(0, 1).toUpperCase()}</span>
                      <span className="sub-tile-text">
                        <strong>{subscription.name}</strong>
                        <small>
                          {money(Number(subscription.price), subscription.currency)}
                          {subscription.intervalCount === 1 ? ` / ${shortCycle[subscription.intervalUnit]}` : ` · ${cycleName(subscription.intervalCount, subscription.intervalUnit)}`}
                        </small>
                        <small>{on ? `ตัดรอบ ${formatDate(subscription.nextDueDate)}` : "พักชำระอยู่"} · {subscription.category}</small>
                      </span>
                      <SubscriptionSwitch id={subscription.id} name={subscription.name} active={on} />
                    </div>
                    <div className="sub-card-actions">
                      <Link className="button button-primary button-sm" href={`/subscriptions/${subscription.id}`}>รายละเอียด</Link>
                      <Link className="button button-secondary button-sm" href={`/subscriptions/${subscription.id}/edit`}>แก้ไข</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {canceled.length > 0 && (
            <details className="canceled-subs">
              <summary>ยกเลิกแล้ว ({canceled.length})</summary>
              <ul>
                {canceled.map((subscription) => (
                  <li key={subscription.id}>
                    <Link href={`/subscriptions/${subscription.id}`}>{subscription.name}</Link>
                    <span className="muted">{money(Number(subscription.price), subscription.currency)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="panel add-sub-panel" aria-labelledby="add-sub-title">
          <h2 id="add-sub-title" className="card-title">เพิ่ม Sub ใหม่ <PlusIcon aria-hidden /></h2>
          <Link className="rainbow-button" href="/subscriptions/new">เพิ่ม Sub ใหม่</Link>
          <p className="muted">ใส่ราคา รอบบิล และวันตัดเงิน แล้วระบบจะเตือนทาง Telegram และอีเมลก่อนถึงกำหนด 7, 3 และ 1 วัน</p>
        </section>
      </div>
    </AppShell>
  );
}
