import Link from "next/link";
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, ClockIcon, MapPinIcon, PlusIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { TaskStatusToggle } from "@/components/task-status-toggle";
import { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { appDateString, dateOnly, formatDate, utcDate } from "@/lib/dates";
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
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const today = appDateString();
  const query = await searchParams;
  const currentMonth = selectedMonth(query.month, today);
  const monthStart = `${currentMonth}-01`;
  const monthLastDay = monthEnd(currentMonth);

  const db = getPrisma();
  const [openTasks, completedTasks, monthShifts] = await Promise.all([
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
  ]);

  // Open tasks sorted by due date with no-date last
  const sortedOpenTasks = [...openTasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });

  // Group shifts by date
  const shiftsByDate = new Map<string, typeof monthShifts>();
  for (const shift of monthShifts) {
    const d = dateOnly(shift.date);
    const list = shiftsByDate.get(d) ?? [];
    list.push(shift);
    shiftsByDate.set(d, list);
  }

  const sortedShiftDates = Array.from(shiftsByDate.keys()).sort();

  return (
    <AppShell email={session.user.email} active="schedule">
      <header className="page-header">
        <div>
          <p className="eyebrow">WORK & SCHEDULE</p>
          <h1>ตารางงาน</h1>
          <p className="muted">จัดการงานสิ่งที่ต้องทำและตารางกะการทำงาน</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/schedule/shifts/new">
            <PlusIcon aria-hidden /> เพิ่มกะงาน
          </Link>
          <Link className="button button-primary" href="/schedule/tasks/new">
            <PlusIcon aria-hidden /> เพิ่มงาน
          </Link>
        </div>
      </header>

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

          {sortedShiftDates.length === 0 ? (
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
            <div className="shift-grouped-list">
              {sortedShiftDates.map((dateStr) => {
                const dateShifts = shiftsByDate.get(dateStr) ?? [];
                const isToday = dateStr === today;
                return (
                  <div className="shift-date-group" key={dateStr}>
                    <div className="shift-date-header">
                      <strong>{formatDate(dateStr)}</strong>
                      {isToday && <span className="today-badge">วันนี้</span>}
                      <small className="muted">({dateShifts.length} กะ)</small>
                    </div>
                    <div className="shift-items">
                      {dateShifts.map((shift) => {
                        const duration = shiftDurationMinutes(
                          shift.startTime,
                          shift.endTime,
                        );
                        return (
                          <div className="shift-row" key={shift.id}>
                            <div className="shift-main">
                              <Link
                                className="shift-title-link"
                                href={`/schedule/shifts/${shift.id}/edit`}
                              >
                                <strong>{shift.title}</strong>
                              </Link>
                              <div className="shift-meta">
                                <span className="shift-time">
                                  <ClockIcon aria-hidden /> {shift.startTime} - {shift.endTime} (
                                  {formatDuration(duration)})
                                </span>
                                {shift.location && (
                                  <span className="shift-location">
                                    <MapPinIcon aria-hidden /> {shift.location}
                                  </span>
                                )}
                              </div>
                              {shift.notes && (
                                <p className="shift-notes">{shift.notes}</p>
                              )}
                            </div>
                            <div className="shift-actions">
                              <Link
                                className="button button-quiet button-sm"
                                href={`/schedule/shifts/${shift.id}/edit`}
                              >
                                แก้ไข
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
