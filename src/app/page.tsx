import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markReminderRead } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { groupCostTotals } from "@/lib/billing";
import { buildCalendarEvents } from "@/lib/calendar";
import { addDays, appDateString, dateOnly, formatDate, utcDate } from "@/lib/dates";
import { cycleName, dayDifference, money } from "@/lib/display";
import { getPrisma } from "@/lib/prisma";
import { reminderMatchesDueDate } from "@/lib/reminders";

function selectedMonth(value: string | string[] | undefined, today: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return today.slice(0, 7);
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== value
    ? today.slice(0, 7)
    : value;
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const today = appDateString();
  const query = await searchParams;
  const calendarMonth = selectedMonth(query.month, today);
  const monthStart = `${calendarMonth}-01`;
  const monthLastDay = monthEnd(calendarMonth);
  const soon = addDays(today, 30);
  const db = getPrisma();
  const [subscriptions, reminders, unreadReminderCount, payments] = await Promise.all([
    db.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      orderBy: { nextDueDate: "asc" },
    }),
    db.reminder.findMany({
      where: { status: "UNREAD" },
      include: { subscription: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.reminder.count({ where: { status: "UNREAD" } }),
    db.payment.findMany({
      where: { coveredDueDate: { gte: utcDate(monthStart), lte: utcDate(monthLastDay) } },
      include: { subscription: { select: { name: true } } },
      orderBy: { coveredDueDate: "asc" },
    }),
  ]);
  const currentReminders = reminders.filter((reminder) =>
    reminderMatchesDueDate(dateOnly(reminder.dueDate), dateOnly(reminder.subscription.nextDueDate)),
  );

  const active = subscriptions;
  const overdue = active.filter((subscription) => dateOnly(subscription.nextDueDate) < today);
  const next7 = active.filter((subscription) => {
    const due = dateOnly(subscription.nextDueDate);
    return due >= today && due <= addDays(today, 7);
  });
  const next30 = active.filter((subscription) => {
    const due = dateOnly(subscription.nextDueDate);
    return due >= today && due <= soon;
  });
  const totals = groupCostTotals(active.map((subscription) => ({
    amount: Number(subscription.price),
    currency: subscription.currency,
    intervalCount: subscription.intervalCount,
    intervalUnit: subscription.intervalUnit,
  })));
  const calendarEvents = buildCalendarEvents({
    month: calendarMonth,
    today,
    subscriptions: active.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      amount: Number(subscription.price),
      currency: subscription.currency,
      intervalCount: subscription.intervalCount,
      intervalUnit: subscription.intervalUnit,
      billingDay: subscription.billingDay,
      nextDueDate: dateOnly(subscription.nextDueDate),
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      subscriptionName: payment.subscription.name,
      amount: Number(payment.amount),
      currency: payment.currency,
      coveredDueDate: dateOnly(payment.coveredDueDate),
    })),
  });

  return (
    <AppShell email={session.user.email}>
      <header className="page-header dashboard-header">
        <div><p className="eyebrow">ภาพรวมการสมัครใช้งาน</p><h1>ภาพรวม</h1><p className="muted">ติดตามค่าใช้จ่ายและวันครบกำหนดของคุณ</p></div>
        <Link className="button button-primary" href="/subscriptions/new"><span aria-hidden="true">＋</span> เพิ่มรายการ</Link>
      </header>

      <section className="metric-grid" aria-label="สรุปค่าใช้จ่าย">
        {Object.entries(totals).map(([currency, total]) => (
          <article className="metric-card" key={currency}>
            <div className="metric-top"><span className="metric-icon violet">↻</span><span className="metric-label">ค่าใช้จ่ายเฉลี่ย / เดือน</span></div>
            <strong className="metric-value">{money(total.monthly, currency)}</strong>
            <span className="metric-sub">คำนวณจากรอบบิลของแต่ละรายการ</span>
          </article>
        ))}
        {Object.entries(totals).map(([currency, total]) => (
          <article className="metric-card" key={`annual-${currency}`}>
            <div className="metric-top"><span className="metric-icon blue">▥</span><span className="metric-label">ค่าใช้จ่ายเฉลี่ย / ปี</span></div>
            <strong className="metric-value">{money(total.annual, currency)}</strong>
            <span className="metric-sub">ประมาณการ 12 เดือน</span>
          </article>
        ))}
        <article className="metric-card">
          <div className="metric-top"><span className="metric-icon green">▤</span><span className="metric-label">กำลังใช้งาน</span></div>
          <strong className="metric-value">{active.length}<small> รายการ</small></strong>
          <span className="metric-sub">จาก Subscription ที่ยัง Active</span>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="metric-icon amber">◷</span><span className="metric-label">ครบกำหนดใน 7 วัน</span></div>
          <strong className="metric-value">{next7.length}<small> รายการ</small></strong>
          <span className="metric-sub">มีอีก {next30.length} รายการใน 30 วัน</span>
        </article>
      </section>

      {Object.keys(totals).length === 0 && <section className="empty-callout"><div className="empty-icon">＋</div><div><strong>เริ่มติดตาม Subscription แรกของคุณ</strong><p>เพิ่มบริการและกำหนดรอบบิล เพื่อดูยอดรวมและการแจ้งเตือนที่นี่</p></div><Link className="button button-primary" href="/subscriptions/new">เพิ่มรายการ</Link></section>}

      <DashboardCalendar key={calendarMonth} month={calendarMonth} today={today} events={calendarEvents} />

      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">NEXT 30 DAYS</p><h2>กำหนดชำระใกล้ถึง</h2></div><Link className="text-link" href="/subscriptions">ดูทั้งหมด <span aria-hidden="true">→</span></Link></div>
          {overdue.length > 0 && <div className="overdue-banner"><span>!</span><div><strong>มีรายการเลยกำหนด {overdue.length} รายการ</strong><p>ระบบจะเลื่อนวันครบกำหนดเมื่อคุณบันทึกว่าจ่ายแล้วเท่านั้น</p></div></div>}
          {next30.length === 0 && overdue.length === 0 ? <p className="empty-note">ยังไม่มีรายการครบกำหนดใน 30 วัน</p> : <div className="due-list">{[...overdue, ...next30].map((subscription) => {
            const due = dateOnly(subscription.nextDueDate);
            const delta = dayDifference(today, due);
            return <Link className="due-row" href={`/subscriptions/${subscription.id}`} key={subscription.id}><span className={`service-avatar avatar-${subscription.name.charCodeAt(0) % 5}`}>{subscription.name.slice(0, 1).toUpperCase()}</span><span className="due-service"><strong>{subscription.name}</strong><small>{cycleName(subscription.intervalCount, subscription.intervalUnit)} · {subscription.category}</small></span><span className="due-date"><strong>{formatDate(due)}</strong><small className={delta < 0 ? "text-danger" : delta <= 7 ? "text-warning" : "muted"}>{delta < 0 ? `เลยกำหนด ${Math.abs(delta)} วัน` : delta === 0 ? "ครบกำหนดวันนี้" : `อีก ${delta} วัน`}</small></span><strong className="due-amount">{money(Number(subscription.price), subscription.currency)}</strong></Link>;
          })}</div>}
        </section>

        <section className="panel reminder-panel">
          <div className="panel-heading"><div><p className="eyebrow">IN-APP REMINDERS</p><h2>การแจ้งเตือน</h2></div><div className="panel-heading-actions"><span className="count-pill">{unreadReminderCount}</span><Link className="text-link" href="/activity">ประวัติ →</Link></div></div>
          {currentReminders.length === 0 ? <div className="reminder-empty"><span className="bell-icon">♧</span><strong>ไม่มีการแจ้งเตือนใหม่</strong><p>รายการเตือนล่วงหน้า 7, 3 และ 1 วันจะแสดงที่นี่</p></div> : <div className="reminder-list">{currentReminders.map((reminder) => <div className="reminder-item" key={reminder.id}><span className="reminder-dot"/><div><strong>{reminder.subscription.name}</strong><p>ครบกำหนด {formatDate(reminder.dueDate)} · อีก {reminder.daysBefore} วัน</p></div><form action={markReminderRead.bind(null, reminder.id)}><button className="icon-button" aria-label="ทำเครื่องหมายว่าอ่านแล้ว" title="ทำเครื่องหมายว่าอ่านแล้ว" type="submit">✓</button></form></div>)}</div>}
          {overdue.length > 0 && <div className="reminder-hint">เมื่อชำระแล้ว ให้เปิดรายการและกด “บันทึกว่าจ่ายแล้ว” เพื่อเลื่อนรอบถัดไป</div>}
        </section>
      </div>
    </AppShell>
  );
}
