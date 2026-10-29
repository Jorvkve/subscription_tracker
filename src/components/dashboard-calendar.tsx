"use client";

import Link from "next/link";
import { useState } from "react";
import type { CalendarEvent } from "@/lib/calendar";
import { calendarGrid } from "@/lib/calendar";
import { cycleName, money } from "@/lib/display";

const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const eventLabels = {
  DUE: "ครบกำหนด",
  OVERDUE: "เลยกำหนด",
  PROJECTED: "รอบถัดไป",
  PAID: "จ่ายแล้ว",
} as const;

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function dateAriaLabel(date: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function DashboardCalendar({
  month,
  today,
  events,
}: {
  month: string;
  today: string;
  events: CalendarEvent[];
}) {
  const [selectedDate, setSelectedDate] = useState(() =>
    today.startsWith(`${month}-`) ? today : events[0]?.date ?? `${month}-01`,
  );
  const grid = calendarGrid(month);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dayEvents = eventsByDate.get(event.date) ?? [];
    dayEvents.push(event);
    eventsByDate.set(event.date, dayEvents);
  }
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  return <section className="panel calendar-panel" aria-label="ปฏิทินกำหนดชำระ">
    <div className="calendar-heading">
      <div><p className="eyebrow">BILLING CALENDAR</p><h2>{monthTitle(month)}</h2><p className="muted">เลือกวันที่เพื่อดูบริการและยอดที่ต้องชำระ</p></div>
      <nav className="calendar-controls" aria-label="เปลี่ยนเดือน">
        <Link className="calendar-nav-button" href={`/?month=${shiftMonth(month, -1)}`} aria-label="เดือนก่อนหน้า">‹</Link>
        <Link className="calendar-today-button" href="/">เดือนนี้</Link>
        <Link className="calendar-nav-button" href={`/?month=${shiftMonth(month, 1)}`} aria-label="เดือนถัดไป">›</Link>
      </nav>
    </div>
    <div className="calendar-grid" role="grid" aria-label={`ปฏิทินเดือน${monthTitle(month)}`}>
      {weekdays.map((day, index) => <div className="calendar-weekday" role="columnheader" key={`${day}-${index}`}>{day}</div>)}
      {grid.flat().map((date, index) => {
        if (!date) return <div className="calendar-day calendar-day-empty" role="gridcell" aria-hidden="true" key={`empty-${index}`} />;
        const dayEvents = eventsByDate.get(date) ?? [];
        const selected = selectedDate === date;
        const hasOverdue = dayEvents.some((event) => event.kind === "OVERDUE");
        const hasPaid = dayEvents.some((event) => event.kind === "PAID");
        return <button
          className={`calendar-day${selected ? " calendar-day-selected" : ""}${date === today ? " calendar-day-today" : ""}${dayEvents.length ? " calendar-day-has-events" : ""}`}
          type="button"
          role="gridcell"
          aria-label={`${dateAriaLabel(date)} มี ${dayEvents.length} รายการ`}
          aria-selected={selected}
          onClick={() => setSelectedDate(date)}
          key={date}
        >
          <span className="calendar-day-number">{Number(date.slice(8))}</span>
          {dayEvents.length > 0 && <span className={`calendar-day-indicator${hasOverdue ? " indicator-overdue" : hasPaid ? " indicator-paid" : ""}`} aria-hidden="true"><i />{dayEvents.length > 1 && <small>{dayEvents.length}</small>}</span>}
        </button>;
      })}
    </div>
    <div className="calendar-legend" aria-label="คำอธิบายสถานะ">
      <span><i className="legend-due" /> ถึงกำหนด</span><span><i className="legend-paid" /> จ่ายแล้ว</span><span><i className="legend-overdue" /> เลยกำหนด</span>
    </div>
    <div className="calendar-day-details">
      <div className="calendar-selected-heading"><h3>{dateAriaLabel(selectedDate)}</h3><span>{selectedEvents.length} รายการ</span></div>
      {selectedEvents.length === 0 ? <p className="calendar-empty-day">ไม่มีรายการครบกำหนดในวันนี้</p> : <div className="calendar-event-list">{selectedEvents.map((event) => <Link className={`calendar-event calendar-event-${event.kind.toLowerCase()}`} href={`/subscriptions/${event.subscriptionId}`} key={event.id}>
        <span className="calendar-event-marker" aria-hidden="true" />
        <span className="calendar-event-main"><strong>{event.name}</strong><small>{event.intervalCount && event.intervalUnit ? cycleName(event.intervalCount, event.intervalUnit) : "ประวัติการชำระ"} · {eventLabels[event.kind]}</small></span>
        <span className="calendar-event-side"><strong>{money(event.amount, event.currency)}</strong><small>{eventLabels[event.kind]}</small></span>
      </Link>)}</div>}
    </div>
  </section>;
}


\n