"use client";

import Link from "next/link";
import { useState } from "react";
import type { CalendarEvent, ScheduleEvent } from "@/lib/calendar";
import { calendarGrid } from "@/lib/calendar";
import { cycleName, money } from "@/lib/display";
import { formatDuration, shiftDurationMinutes } from "@/lib/time-of-day";

const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const eventLabels = {
  DUE: "ครบกำหนด",
  OVERDUE: "เลยกำหนด",
  PROJECTED: "รอบถัดไป",
  PAID: "จ่ายแล้ว",
} as const;

const taskPriorityLabels: Record<string, string> = {
  LOW: "ต่ำ",
  MEDIUM: "ปานกลาง",
  HIGH: "สูง",
};

const taskStatusLabels: Record<string, string> = {
  TODO: "รอทำ",
  IN_PROGRESS: "กำลังทำ",
  DONE: "เสร็จแล้ว",
};

const taskStatusBadgeClass: Record<string, string> = {
  TODO: "paused",
  IN_PROGRESS: "active",
  DONE: "canceled",
};

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
  scheduleEvents = [],
}: {
  month: string;
  today: string;
  events: CalendarEvent[];
  scheduleEvents?: ScheduleEvent[];
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (today.startsWith(`${month}-`)) return today;
    const firstDate = [events[0]?.date, scheduleEvents[0]?.date]
      .filter((d): d is string => Boolean(d))
      .sort()[0];
    return firstDate ?? `${month}-01`;
  });

  const grid = calendarGrid(month);

  const billingByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dayEvents = billingByDate.get(event.date) ?? [];
    dayEvents.push(event);
    billingByDate.set(event.date, dayEvents);
  }

  const scheduleByDate = new Map<string, ScheduleEvent[]>();
  for (const event of scheduleEvents) {
    const dayEvents = scheduleByDate.get(event.date) ?? [];
    dayEvents.push(event);
    scheduleByDate.set(event.date, dayEvents);
  }

  const selectedBilling = billingByDate.get(selectedDate) ?? [];
  const selectedSchedule = scheduleByDate.get(selectedDate) ?? [];
  const selectedTotalCount = selectedBilling.length + selectedSchedule.length;

  return (
    <section className="panel calendar-panel" aria-label="ปฏิทินงานและกำหนดชำระ">
      <div className="calendar-heading">
        <div>
          <p className="eyebrow">CALENDAR & SCHEDULE</p>
          <h2>{monthTitle(month)}</h2>
          <p className="muted">เลือกวันที่เพื่อดูกำหนดชำระ งาน และกะเวลา</p>
        </div>
        <nav className="calendar-controls" aria-label="เปลี่ยนเดือน">
          <Link
            className="calendar-nav-button"
            href={`/?month=${shiftMonth(month, -1)}`}
            aria-label="เดือนก่อนหน้า"
          >
            ‹
          </Link>
          <Link className="calendar-today-button" href="/">
            เดือนนี้
          </Link>
          <Link
            className="calendar-nav-button"
            href={`/?month=${shiftMonth(month, 1)}`}
            aria-label="เดือนถัดไป"
          >
            ›
          </Link>
        </nav>
      </div>

      <div className="calendar-grid" role="grid" aria-label={`ปฏิทินเดือน${monthTitle(month)}`}>
        {weekdays.map((day, index) => (
          <div className="calendar-weekday" role="columnheader" key={`${day}-${index}`}>
            {day}
          </div>
        ))}
        {grid.flat().map((date, index) => {
          if (!date) {
            return (
              <div
                className="calendar-day calendar-day-empty"
                role="gridcell"
                aria-hidden="true"
                key={`empty-${index}`}
              />
            );
          }
          const dayBilling = billingByDate.get(date) ?? [];
          const daySchedule = scheduleByDate.get(date) ?? [];
          const totalCount = dayBilling.length + daySchedule.length;
          const selected = selectedDate === date;
          const hasOverdue = dayBilling.some((event) => event.kind === "OVERDUE");
          const hasPaid = dayBilling.some((event) => event.kind === "PAID");
          const dayShifts = daySchedule.filter((event) => event.kind === "SHIFT");
          // Shifts get their own chips, so the indicator covers billing and tasks only.
          const indicatorCount = totalCount - dayShifts.length;
          const hasTask = daySchedule.length > dayShifts.length;

          let indicatorClass = "";
          if (hasOverdue) indicatorClass = " indicator-overdue";
          else if (hasPaid) indicatorClass = " indicator-paid";
          else if (hasTask && dayBilling.length === 0) indicatorClass = " indicator-task";

          return (
            <button
              className={`calendar-day${selected ? " calendar-day-selected" : ""}${
                date === today ? " calendar-day-today" : ""
              }${totalCount > 0 ? " calendar-day-has-events" : ""}`}
              type="button"
              role="gridcell"
              aria-label={`${dateAriaLabel(date)} มี ${totalCount} รายการ`}
              aria-selected={selected}
              onClick={() => setSelectedDate(date)}
              key={date}
            >
              <span className="calendar-day-number">{Number(date.slice(8))}</span>
              {indicatorCount > 0 && (
                <span
                  className={`calendar-day-indicator${indicatorClass}`}
                  aria-hidden="true"
                >
                  <i />
                  {indicatorCount > 1 && <small>{indicatorCount}</small>}
                </span>
              )}
              {dayShifts.length > 0 && (
                <span className="calendar-day-shifts" aria-hidden="true">
                  <span className="calendar-day-shift-dot" />
                  {dayShifts.slice(0, 2).map((shift) => (
                    <span className="calendar-day-shift" key={shift.id}>
                      {shift.time} {shift.title}
                    </span>
                  ))}
                  {dayShifts.length > 2 && (
                    <span className="calendar-day-shift-more">+{dayShifts.length - 2}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="calendar-legend" aria-label="คำอธิบายสถานะ">
        <span><i className="legend-due" /> ถึงกำหนด</span>
        <span><i className="legend-paid" /> จ่ายแล้ว</span>
        <span><i className="legend-overdue" /> เลยกำหนด</span>
        <span><i className="legend-task" /> งาน</span>
        <span><i className="legend-shift" /> กะ</span>
      </div>

      <div className="calendar-day-details">
        <div className="calendar-selected-heading">
          <h3>{dateAriaLabel(selectedDate)}</h3>
          <span>{selectedTotalCount} รายการ</span>
        </div>

        {selectedTotalCount === 0 ? (
          <p className="calendar-empty-day">ไม่มีรายการในวันนี้</p>
        ) : (
          <div className="calendar-event-list">
            {selectedBilling.map((event) => (
              <Link
                className={`calendar-event calendar-event-${event.kind.toLowerCase()}`}
                href={`/subscriptions/${event.subscriptionId}`}
                key={event.id}
              >
                <span className="calendar-event-marker" aria-hidden="true" />
                <span className="calendar-event-main">
                  <strong>{event.name}</strong>
                  <small>
                    {event.intervalCount && event.intervalUnit
                      ? cycleName(event.intervalCount, event.intervalUnit)
                      : "ประวัติการชำระ"}{" "}
                    · {eventLabels[event.kind]}
                    {event.chargeTime ? ` · เวลา ${event.chargeTime} น.` : ""}
                  </small>
                </span>
                <span className="calendar-event-side">
                  <strong>{money(event.amount, event.currency)}</strong>
                  <small>{event.chargeTime ? `${event.chargeTime} น.` : eventLabels[event.kind]}</small>
                </span>
              </Link>
            ))}

            {selectedSchedule.map((event) =>
              event.kind === "TASK" ? (
                <Link
                  className="calendar-event calendar-event-task"
                  href={`/schedule/tasks/${event.id}/edit`}
                  key={`task-${event.id}`}
                >
                  <span className="calendar-event-marker marker-task" aria-hidden="true" />
                  <span className="calendar-event-main">
                    <strong>{event.title}</strong>
                    <small>
                      งาน · ความสำคัญ: {taskPriorityLabels[event.priority] ?? event.priority} ·{" "}
                      {taskStatusLabels[event.status] ?? event.status}
                    </small>
                  </span>
                  <span className="calendar-event-side">
                    <span
                      className={`status-badge status-${taskStatusBadgeClass[event.status] ?? "neutral"}`}
                    >
                      <i /> {taskStatusLabels[event.status] ?? event.status}
                    </span>
                  </span>
                </Link>
              ) : (
                <Link
                  className="calendar-event calendar-event-shift"
                  href={`/schedule/shifts/${event.id}/edit`}
                  key={`shift-${event.id}`}
                >
                  <span className="calendar-event-marker marker-shift" aria-hidden="true" />
                  <span className="calendar-event-main">
                    <strong>{event.title}</strong>
                    <small>
                      กะเวลา {event.startTime} - {event.endTime}
                      {event.location ? ` · ${event.location}` : ""}
                    </small>
                  </span>
                  <span className="calendar-event-side">
                    <strong>
                      {formatDuration(shiftDurationMinutes(event.startTime, event.endTime))}
                    </strong>
                    <small>
                      {event.startTime} - {event.endTime}
                    </small>
                  </span>
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
