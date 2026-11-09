import Link from "next/link";
import { ArrowRightIcon, BellIcon, CheckIcon, PlusIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markReminderRead } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { SpendDonut } from "@/components/spend-donut";
import { SubscriptionSwitch } from "@/components/subscription-switch";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { groupCostTotals } from "@/lib/billing";
import { buildCalendarEvents, buildScheduleEvents } from "@/lib/calendar";
import { shiftTone, spendByCategory, weekDates } from "@/lib/dashboard";
import { addDays, appDateString, appTimeString, dateOnly, formatDate, utcDate } from "@/lib/dates";
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

function thaiDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("th-TH", { ...options, timeZone: "UTC" }).format(utcDate(date));
}

const shiftToneLabels = { day: "กะเช้า", afternoon: "กะบ่าย", night: "กะดึก" } as const;
const shortCycle = { DAY: "วัน", WEEK: "สัปดาห์", MONTH: "เดือน", YEAR: "ปี" } as const;

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
  const thisMonth = today.slice(0, 7);
  const week = weekDates(today);
  const tomorrow = addDays(today, 1);
  const db = getPrisma();
  const [subscriptions, reminders, unreadReminderCount, payments, tasks, shifts, weekShifts, slips] = await Promise.all([
    db.subscription.findMany({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED] } },
      orderBy: { nextDueDate: "asc" },
    }),
    db.reminder.findMany({
      where: { status: "UNREAD", subscription: { status: SubscriptionStatus.ACTIVE } },
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
    db.task.findMany({
      where: {
        dueDate: { gte: utcDate(monthStart), lte: utcDate(monthLastDay) },
      },
      orderBy: { dueDate: "asc" },
    }),
    db.workShift.findMany({
      where: {
        date: { gte: utcDate(monthStart), lte: utcDate(monthLastDay) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.workShift.findMany({
      where: { date: { gte: utcDate(week[0]), lte: utcDate(week[6]) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.expenseSlip.findMany({
      where: { paidDate: { gte: utcDate(`${thisMonth}-01`), lte: utcDate(monthEnd(thisMonth)) } },
      select: { amount: true, currency: true, category: true },
    }),
  ]);
  const currentReminders = reminders.filter((reminder) =>
    reminderMatchesDueDate(dateOnly(reminder.dueDate), dateOnly(reminder.subscription.nextDueDate)),
  );

  const active = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE);
  const overdue = active.filter((subscription) => dateOnly(subscription.nextDueDate) < today);
  const next7 = active.filter((subscription) => {
    const due = dateOnly(subscription.nextDueDate);
    return due >= today && due <= addDays(today, 7);
  });
  const nextDue = active.find((subscription) => dateOnly(subscription.nextDueDate) >= today);
  const totals = groupCostTotals(active.map((subscription) => ({
    amount: Number(subscription.price),
    currency: subscription.currency,
    intervalCount: subscription.intervalCount,
    intervalUnit: subscription.intervalUnit,
  })));

  // Spending this month: the donut uses THB; other currencies are listed as extra totals.
  const thbSlips = slips.filter((slip) => slip.currency === "THB").map((slip) => ({ category: slip.category, amount: Number(slip.amount) }));
  const spentThb = thbSlips.reduce((sum, slip) => sum + slip.amount, 0);
  const otherSpend: Record<string, number> = {};
  for (const slip of slips) {
    if (slip.currency !== "THB") otherSpend[slip.currency] = (otherSpend[slip.currency] ?? 0) + Number(slip.amount);
  }
  const categories = spendByCategory(thbSlips);
  const daysSoFar = Number(today.slice(8));

  const shiftsByDate = new Map<string, typeof weekShifts>();
  for (const shift of weekShifts) {
    const key = dateOnly(shift.date);
    shiftsByDate.set(key, [...(shiftsByDate.get(key) ?? []), shift]);
  }
  const todayShifts = shiftsByDate.get(today) ?? [];
  const tomorrowShifts = tomorrow <= week[6]
    ? shiftsByDate.get(tomorrow) ?? []
    : await db.workShift.findMany({ where: { date: utcDate(tomorrow) }, orderBy: { startTime: "asc" } });
  const alertCount = currentReminders.length + overdue.length + todayShifts.length + tomorrowShifts.length;

  const firstName = session.user.name?.trim().split(/\s+/)[0] || session.user.email.split("@")[0];

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
      chargeTime: subscription.chargeTime,
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

  const scheduleEvents = buildScheduleEvents({
    month: calendarMonth,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate ? dateOnly(task.dueDate) : null,
      priority: task.priority,
      status: task.status,
    })),
    shifts: shifts.map((shift) => ({
      id: shift.id,
      title: shift.title,
      date: dateOnly(shift.date),
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      notes: shift.notes,
    })),
  });

  return (
    <AppShell email={session.user.email}>
      <header className="page-header dashboard-header">
        <div>
          <h1 className="greeting">สวัสดี, <span className="greeting-name">{firstName}</span>! พร้อมลุยวันนี้ไหม <span aria-hidden>💸</span></h1>
          <p className="muted">ติดตามค่าใช้จ่าย Subscription และกะงานของคุณในที่เดียว</p>
        </div>
        <p className="header-clock">
          {thaiDate(today, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          <span> · {appTimeString()} น.</span>
        </p>
      </header>

      <div className="dash-grid">
        <section className="panel dash-spend" aria-labelledby="spend-title">
          <div className="dash-spend-main">
            <h2 id="spend-title" className="card-title">ใช้ไปเดือนนี้</h2>
            <strong className="big-number">{money(spentThb, "THB")}</strong>
            {Object.entries(otherSpend).map(([currency, amount]) => (
              <span className="big-number-extra" key={currency}>+ {money(amount, currency)}</span>
            ))}
            <p className="muted dash-line">
              {slips.length === 0 ? "ยังไม่มีสลิปเดือนนี้" : `${slips.length} รายการ · เฉลี่ย ${money(spentThb / daysSoFar, "THB")} / วัน`} <span aria-hidden>🧾</span>
            </p>
            <div className="dash-sub-cost">
              <span className="muted">ค่า Subscription ต่อเดือน</span>
              {Object.keys(totals).length === 0
                ? <strong>—</strong>
                : Object.entries(totals).map(([currency, total]) => <strong key={currency}>{money(total.monthly, currency)}</strong>)}
            </div>
            <Link className="button button-primary" href="/slips/new"><PlusIcon aria-hidden /> เพิ่มสลิป</Link>
          </div>
          <SpendDonut categories={categories} centre={categories.length ? "🛒" : "😴"} />
        </section>

        <section className="panel dash-shifts" aria-labelledby="shift-title">
          <div className="card-heading">
            <h2 id="shift-title" className="card-title">กะงานสัปดาห์นี้ <span aria-hidden>📅</span></h2>
            <span className="chip">{thaiDate(week[0], { day: "numeric", month: "short" })} – {thaiDate(week[6], { day: "numeric", month: "short" })}</span>
          </div>
          <ul className="week-list">
            {week.map((date) => {
              const dayShifts = shiftsByDate.get(date) ?? [];
              return (
                <li className={date === today ? "week-row week-today" : "week-row"} key={date}>
                  <span className="week-day">{thaiDate(date, { weekday: "short" })}<small>{Number(date.slice(8))}</small></span>
                  <span className="week-pills">
                    {dayShifts.length === 0
                      ? <span className="shift-pill tone-off">วันว่าง <span aria-hidden>🏖️</span></span>
                      : dayShifts.map((shift) => (
                        <Link className={`shift-pill tone-${shiftTone(shift.startTime)}`} href={`/schedule/shifts/${shift.id}/edit`} key={shift.id} title={`${shiftToneLabels[shiftTone(shift.startTime)]} · ${shift.title}`}>
                          {shift.startTime} – {shift.endTime} <span className="shift-pill-title">({shift.title})</span>
                        </Link>
                      ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="card-actions">
            <Link className="button button-primary" href="/schedule/shifts/new"><PlusIcon aria-hidden /> เพิ่มกะ</Link>
            <Link className="button button-blue" href="/schedule">ดูตารางงาน</Link>
          </div>
        </section>

        <section className="panel dash-subs" aria-labelledby="subs-title">
          <div className="card-heading">
            <h2 id="subs-title" className="card-title">Subs ของคุณ <span aria-hidden>🍿</span></h2>
            <Link className="text-link" href="/subscriptions">ดูทั้งหมด <ArrowRightIcon aria-hidden /></Link>
          </div>
          {subscriptions.length === 0 ? (
            <div className="empty-callout"><div className="empty-icon"><PlusIcon aria-hidden /></div><div><strong>เริ่มติดตาม Subscription แรกของคุณ</strong><p>เพิ่มบริการและกำหนดรอบบิล เพื่อดูยอดรวมและการแจ้งเตือนที่นี่</p></div><Link className="button button-primary" href="/subscriptions/new">เพิ่มรายการ</Link></div>
          ) : (
            <ul className="sub-tiles">
              {subscriptions.slice(0, 6).map((subscription) => {
                const on = subscription.status === SubscriptionStatus.ACTIVE;
                return (
                  <li className={on ? "sub-tile" : "sub-tile sub-tile-off"} key={subscription.id}>
                    <Link className="sub-tile-link" href={`/subscriptions/${subscription.id}`}>
                      <span className={`service-avatar avatar-${subscription.name.charCodeAt(0) % 5}`}>{subscription.name.slice(0, 1).toUpperCase()}</span>
                      <span className="sub-tile-text">
                        <strong>{subscription.name}</strong>
                        <small>{money(Number(subscription.price), subscription.currency)}{subscription.intervalCount === 1 ? ` / ${shortCycle[subscription.intervalUnit]}` : ` · ${cycleName(subscription.intervalCount, subscription.intervalUnit)}`}</small>
                      </span>
                    </Link>
                    <SubscriptionSwitch id={subscription.id} name={subscription.name} active={on} />
                  </li>
                );
              })}
            </ul>
          )}
          {subscriptions.length > 0 && (
            <div className="subs-footer">
              <span className="muted">
                {nextDue ? <>ถัดไป: {formatDate(nextDue.nextDueDate)} ({nextDue.name})</> : "ไม่มีรายการที่รอชำระ"}
              </span>
              <span className="subs-total">
                รวม {Object.entries(totals).map(([currency, total]) => money(total.monthly, currency)).join(" + ") || money(0, "THB")} / เดือน
              </span>
              <Link className="button button-secondary button-sm" href="/subscriptions/new"><PlusIcon aria-hidden /> เพิ่ม</Link>
            </div>
          )}
        </section>

        <div className="dash-side">
          <section className="panel dash-due" aria-labelledby="due-title">
            <div className="card-heading">
              <h2 id="due-title" className="card-title">ใกล้ครบกำหนด <span aria-hidden>⏰</span></h2>
              <span className="count-pill">{overdue.length + next7.length}</span>
            </div>
            {overdue.length + next7.length === 0 ? <p className="empty-note">ไม่มีรายการใน 7 วันนี้ <span aria-hidden>🎉</span></p> : (
              <ul className="due-mini">
                {[...overdue, ...next7].slice(0, 4).map((subscription) => {
                  const delta = dayDifference(today, dateOnly(subscription.nextDueDate));
                  return (
                    <li key={subscription.id}>
                      <Link href={`/subscriptions/${subscription.id}`}>
                        <span className="due-mini-name">{subscription.name}<small className={delta < 0 ? "text-danger" : delta <= 1 ? "text-warning" : "muted"}>{delta < 0 ? `เลยกำหนด ${Math.abs(delta)} วัน` : delta === 0 ? "วันนี้" : delta === 1 ? "พรุ่งนี้" : `อีก ${delta} วัน`}</small></span>
                        <b>{money(Number(subscription.price), subscription.currency)}</b>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel dash-alerts" aria-labelledby="alert-title">
            <div className="card-heading">
              <h2 id="alert-title" className="card-title">แจ้งเตือน <span aria-hidden>🚨</span></h2>
              <Link className="text-link" href="/activity" aria-label={`ประวัติการแจ้งเตือน (${unreadReminderCount} ยังไม่อ่าน)`}>ประวัติ <ArrowRightIcon aria-hidden /></Link>
            </div>
            {alertCount === 0 ? (
              <div className="reminder-empty"><span className="bell-icon"><BellIcon aria-hidden /></span><strong>ไม่มีการแจ้งเตือนใหม่</strong></div>
            ) : (
              <ul className="alert-list">
                {overdue.map((subscription) => (
                  <li className="alert-item alert-danger" key={`overdue-${subscription.id}`}>
                    <span aria-hidden>⚠️</span>
                    <Link href={`/subscriptions/${subscription.id}`}>{subscription.name} เลยกำหนดจ่าย</Link>
                  </li>
                ))}
                {currentReminders.map((reminder) => (
                  <li className="alert-item" key={reminder.id}>
                    <span aria-hidden>🔔</span>
                    <Link href={`/subscriptions/${reminder.subscriptionId}`}>จ่าย {reminder.subscription.name} {reminder.daysBefore === 1 ? "พรุ่งนี้" : `ในอีก ${reminder.daysBefore} วัน`}</Link>
                    <form action={markReminderRead.bind(null, reminder.id)}><button className="icon-button" aria-label="ทำเครื่องหมายว่าอ่านแล้ว" title="ทำเครื่องหมายว่าอ่านแล้ว" type="submit"><CheckIcon aria-hidden /></button></form>
                  </li>
                ))}
                {todayShifts.map((shift) => (
                  <li className="alert-item" key={`today-${shift.id}`}><span aria-hidden>💼</span><span>วันนี้เข้ากะ {shift.startTime} น. ({shift.title})</span></li>
                ))}
                {tomorrowShifts.map((shift) => (
                  <li className="alert-item" key={`tomorrow-${shift.id}`}><span aria-hidden>💼</span><span>พรุ่งนี้เข้ากะ {shift.startTime} น. ({shift.title})</span></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <DashboardCalendar
        key={calendarMonth}
        month={calendarMonth}
        today={today}
        events={calendarEvents}
        scheduleEvents={scheduleEvents}
      />
    </AppShell>
  );
}
