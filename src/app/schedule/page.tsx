import Link from "next/link";
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, PlusIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { TaskStatusToggle } from "@/components/task-status-toggle";
import { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { HeroHeader, firstName } from "@/components/hero-header";
import { shiftTone, weekDates } from "@/lib/dashboard";
import { addDays, appDateString, dateOnly, formatDate, utcDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { formatDuration, shiftDurationMinutes } from "@/lib/time-of-day";

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

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "ต่ำ",
  MEDIUM: "ปานกลาง",
  HIGH: "สูง",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; week?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const today = appDateString();
  const query = await searchParams;
  const currentMonth = selectedMonth(query.month, today);
  const monthStart = `${currentMonth}-01`;
  const monthLastDay = monthEnd(currentMonth);

  const anchor = typeof query.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.week) && !Number.isNaN(Date.parse(query.week))
    ? query.week
    : today;
  const gridStart = weekDates(anchor)[0];
  const gridDates = Array.from({ length: 14 }, (_, index) => addDays(gridStart, index));
  const thisWeek = weekDates(today);
  const tomorrow = addDays(today, 1);

  const db = getPrisma();
  const [openTasks, completedTasks, monthShifts, gridShifts, weekShifts] = await Promise.all([
    db.task.findMany({
      where: {
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
    }),
    db.task.findMany({
      where: {
        status: TaskStatus.DONE,
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
    db.workShift.findMany({
      where: {
        date: {
          gte: utcDate(monthStart),
          lte: utcDate(monthLastDay),
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.workShift.findMany({
      where: { date: { gte: utcDate(gridDates[0]), lte: utcDate(gridDates[13]) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    // This week, plus tomorrow when today is Sunday.
    db.workShift.findMany({
      where: { date: { gte: utcDate(thisWeek[0]), lte: utcDate(tomorrow > thisWeek[6] ? tomorrow : thisWeek[6]) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const gridByDate = new Map<string, typeof gridShifts>();
  for (const shift of gridShifts) {
    const key = dateOnly(shift.date);
    gridByDate.set(key, [...(gridByDate.get(key) ?? []), shift]);
  }
  const thisWeekShifts = weekShifts.filter((shift) => dateOnly(shift.date) <= thisWeek[6]);
  const weekMinutes = thisWeekShifts.reduce((sum, shift) => sum + shiftDurationMinutes(shift.startTime, shift.endTime), 0);
  const hoursTarget = 40;
  const soonShifts = weekShifts.filter((shift) => {
    const date = dateOnly(shift.date);
    return date === today || date === tomorrow;
  });
  const dueTasks = openTasks
    .filter((task) => task.dueDate && dateOnly(task.dueDate) <= addDays(today, 2))
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const weekdayShort = (date: string) => new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "UTC" }).format(utcDate(date));

  // Open tasks sorted by due date with no-date last
  const sortedOpenTasks = [...openTasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });

  // In the current month, upcoming shifts come first and past ones fold away.
  const upcomingShifts = monthShifts.filter((shift) => dateOnly(shift.date) >= today);
  const pastShifts = monthShifts.filter((shift) => dateOnly(shift.date) < today);

  return (
    <AppShell email={session.user.email} active="schedule">
      <HeroHeader title="ตารางงาน" accent="& กะงาน" name={firstName(session.user)} tagline="จดกะงานไว้ ไม่พลาดสักกะ ⏰" />

      <div className="shift-top-grid">
        <section className="panel" aria-labelledby="two-week-title">
          <div className="card-heading">
            <h2 id="two-week-title" className="card-title">ปฏิทินกะ <span className="card-title-sub">(2 สัปดาห์)</span></h2>
            <nav className="calendar-controls" aria-label="เปลี่ยนช่วงสัปดาห์">
              <Link className="calendar-nav-button" href={`/schedule?week=${addDays(gridStart, -14)}`} aria-label="2 สัปดาห์ก่อนหน้า"><CaretLeftIcon aria-hidden /></Link>
              <Link className="calendar-today-button" href="/schedule">สัปดาห์นี้</Link>
              <Link className="calendar-nav-button" href={`/schedule?week=${addDays(gridStart, 14)}`} aria-label="2 สัปดาห์ถัดไป"><CaretRightIcon aria-hidden /></Link>
            </nav>
          </div>
          <p className="muted two-week-range">{formatDate(gridDates[0])} – {formatDate(gridDates[13])}</p>
          <ol className="two-week">
            {gridDates.map((date) => {
              const dayShifts = gridByDate.get(date) ?? [];
              return (
                <li className={`tw-day${date === today ? " tw-today" : ""}${dayShifts.length === 0 ? " tw-off" : ""}`} key={date}>
                  <span className="tw-date">{weekdayShort(date)} <b>{Number(date.slice(8))}</b></span>
                  {dayShifts.length === 0
                    ? <span className="tw-empty">ว่าง</span>
                    : dayShifts.map((shift) => (
                      <Link className={`shift-pill tw-pill tone-${shiftTone(shift.startTime)}`} href={`/schedule/shifts/${shift.id}/edit`} key={shift.id}>
                        <span>{shift.title}</span>
                        <small>{shift.startTime}–{shift.endTime}</small>
                      </Link>
                    ))}
                </li>
              );
            })}
          </ol>
          <div className="card-actions">
            <Link className="button button-primary" href="/schedule/shifts/new"><PlusIcon aria-hidden /> เพิ่มกะงาน</Link>
            <Link className="button button-blue" href="/schedule/tasks/new"><PlusIcon aria-hidden /> เพิ่มงาน</Link>
          </div>
        </section>

        <div className="shift-side">
          <section className="panel" aria-labelledby="hustle-title">
            <h2 id="hustle-title" className="card-title card-title-gap">Hustle สัปดาห์นี้ <span aria-hidden>⏰</span></h2>
            <div className="hustle-stats">
              <div><span className="muted">ชั่วโมงรวม</span><strong className="big-number">{formatDuration(weekMinutes)}</strong></div>
              <div><span className="muted">จำนวนกะ</span><strong className="big-number">{thisWeekShifts.length} <small className="big-number-unit">กะ</small></strong></div>
            </div>
            <div className="progress" role="progressbar" aria-label={`ชั่วโมงทำงานเทียบเป้า ${hoursTarget} ชั่วโมง`} aria-valuemin={0} aria-valuemax={hoursTarget} aria-valuenow={Math.round(weekMinutes / 60)}>
              <span style={{ width: `${Math.min(100, (weekMinutes / 60 / hoursTarget) * 100)}%` }} />
            </div>
            <p className="muted card-note">เทียบกับ {hoursTarget} ชั่วโมงต่อสัปดาห์ <span aria-hidden>⚡</span></p>
          </section>

          <section className="panel" aria-labelledby="shift-alert-title">
            <h2 id="shift-alert-title" className="card-title card-title-gap">เตือนความจำ <span aria-hidden>🚨</span></h2>
            {soonShifts.length + dueTasks.length === 0 ? <p className="empty-note">ไม่มีอะไรด่วนใน 2 วันนี้ <span aria-hidden>😌</span></p> : (
              <ul className="alert-list">
                {soonShifts.map((shift) => (
                  <li className="alert-item" key={shift.id}>
                    <span aria-hidden>{shiftTone(shift.startTime) === "night" ? "🌙" : "💼"}</span>
                    <Link href={`/schedule/shifts/${shift.id}/edit`}>{dateOnly(shift.date) === today ? "วันนี้" : "พรุ่งนี้"}เข้ากะ {shift.startTime} น. ({shift.title})</Link>
                  </li>
                ))}
                {dueTasks.map((task) => {
                  const due = task.dueDate ? dateOnly(task.dueDate) : today;
                  return (
                    <li className={due < today ? "alert-item alert-danger" : "alert-item"} key={task.id}>
                      <span aria-hidden>📝</span>
                      <Link href={`/schedule/tasks/${task.id}/edit`}>{task.title} · {due < today ? "เลยกำหนด" : due === today ? "ส่งวันนี้" : `ส่ง ${formatDate(due)}`}</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="schedule-layout">
        {/* Panel 1: Tasks */}
        <section className="panel" aria-label="รายการงาน">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TASKS</p>
              <h2>รายการงาน</h2>
            </div>
          </div>

          <div className="task-section">
            <h3 className="section-title">งานที่ต้องทำ ({sortedOpenTasks.length})</h3>
            {sortedOpenTasks.length === 0 ? (
              <p className="empty-note">ไม่มีงานค้างอยู่ในขณะนี้</p>
            ) : (
              <div className="task-list">
                {sortedOpenTasks.map((task) => {
                  const dueDateStr = task.dueDate ? dateOnly(task.dueDate) : null;
                  const isOverdue = dueDateStr !== null && dueDateStr < today;
                  return (
                    <div
                      className={`task-row${isOverdue ? " task-overdue" : ""}`}
                      key={task.id}
                    >
                      <div className="task-main">
                        <div className="task-header-line">
                          <Link
                            className="task-title-link"
                            href={`/schedule/tasks/${task.id}/edit`}
                          >
                            <strong>{task.title}</strong>
                          </Link>
                          {isOverdue && (
                            <span className="overdue-tag">! เลยกำหนด</span>
                          )}
                          <span
                            className={`priority-tag priority-${task.priority.toLowerCase()}`}
                          >
                            ความสำคัญ: {priorityLabels[task.priority]}
                          </span>
                        </div>
                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}
                        <div className="task-meta">
                          <span className={isOverdue ? "text-danger" : "muted"}>
                            {dueDateStr
                              ? `กำหนดส่ง: ${formatDate(dueDateStr)}`
                              : "ไม่มีกำหนดส่ง"}
                          </span>
                        </div>
                      </div>
                      <div className="task-actions">
                        <TaskStatusToggle taskId={task.id} status={task.status} />
                        <Link
                          className="button button-quiet button-sm"
                          href={`/schedule/tasks/${task.id}/edit`}
                        >
                          แก้ไข
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {completedTasks.length > 0 && (
            <div className="task-section completed-section">
              <h3 className="section-title">งานที่เสร็จแล้ว (ล่าสุด {completedTasks.length} รายการ)</h3>
              <div className="task-list">
                {completedTasks.map((task) => (
                  <div className="task-row task-done" key={task.id}>
                    <div className="task-main">
                      <Link
                        className="task-title-link"
                        href={`/schedule/tasks/${task.id}/edit`}
                      >
                        <del>{task.title}</del>
                      </Link>
                      <div className="task-meta">
                        <small className="muted">
                          {task.completedAt
                            ? `เสร็จเมื่อ: ${formatDate(appDateString(task.completedAt))}`
                            : "เสร็จแล้ว"}
                        </small>
                      </div>
                    </div>
                    <div className="task-actions">
                      <TaskStatusToggle taskId={task.id} status={task.status} />
                      <Link
                        className="button button-quiet button-sm"
                        href={`/schedule/tasks/${task.id}/edit`}
                      >
                        แก้ไข
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Panel 2: Shifts */}
        <section className="panel" aria-label="ตารางกะงาน">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">WORK SHIFTS</p>
              <h2>ตารางกะงาน ({monthShifts.length})</h2>
            </div>
            <nav className="calendar-controls" aria-label="เปลี่ยนเดือนกะงาน">
              <Link
                className="calendar-nav-button"
                href={`/schedule?month=${shiftMonth(currentMonth, -1)}`}
                aria-label="เดือนก่อนหน้า"
              >
                <CaretLeftIcon aria-hidden />
              </Link>
              <span className="month-indicator">{monthTitle(currentMonth)}</span>
              <Link
                className="calendar-nav-button"
                href={`/schedule?month=${shiftMonth(currentMonth, 1)}`}
                aria-label="เดือนถัดไป"
              >
                <CaretRightIcon aria-hidden />
              </Link>
            </nav>
          </div>

          {monthShifts.length === 0 ? (
            <div className="empty-callout">
              <div className="empty-icon"><CalendarBlankIcon aria-hidden /></div>
              <div>
                <strong>ยังไม่มีกะงานในเดือน{monthTitle(currentMonth)}</strong>
                <p>กดเพิ่มกะงานเพื่อบันทึกวันและเวลากะงานของคุณ</p>
              </div>
              <Link className="button button-primary" href="/schedule/shifts/new">
                เพิ่มกะงาน
              </Link>
            </div>
          ) : (
            <>
              {upcomingShifts.length > 0 && <div className="shift-panel-lines"><ShiftLines shifts={upcomingShifts} today={today} /></div>}
              {upcomingShifts.length === 0 && <p className="empty-note">ไม่มีกะที่จะถึงในเดือนนี้</p>}
              {pastShifts.length > 0 && (
                <details className="shift-past" open={upcomingShifts.length === 0}>
                  <summary>กะที่ผ่านมาแล้ว ({pastShifts.length})</summary>
                  <div className="shift-panel-lines"><ShiftLines shifts={pastShifts} today={today} /></div>
                </details>
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

const weekdayFormat = new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "UTC" });

type ShiftLine = {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
};

/** One compact, fully clickable row per shift, so a month of shifts stays short. */
function ShiftLines({ shifts, today }: { shifts: readonly ShiftLine[]; today: string }) {
  return (
    <ul className="shift-lines">
      {shifts.map((shift) => {
        const date = dateOnly(shift.date);
        const details = [
          `${shift.startTime}–${shift.endTime}`,
          formatDuration(shiftDurationMinutes(shift.startTime, shift.endTime)),
          shift.location,
          shift.notes,
        ].filter(Boolean).join(" · ");
        return (
          <li key={shift.id}>
            <Link
              className={`shift-line${date === today ? " shift-line-today" : ""}`}
              href={`/schedule/shifts/${shift.id}/edit`}
              aria-label={`แก้ไขกะ ${shift.title} วันที่ ${formatDate(date)}`}
            >
              <span className="shift-line-date">
                <b>{Number(date.slice(8, 10))}</b>
                <small>{date === today ? "วันนี้" : weekdayFormat.format(utcDate(date))}</small>
              </span>
              <span className={`shift-line-bar tone-${shiftTone(shift.startTime)}`} aria-hidden />
              <span className="shift-line-main">
                <strong>{shift.title}</strong>
                <small>{details}</small>
              </span>
              <CaretRightIcon className="shift-line-caret" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
