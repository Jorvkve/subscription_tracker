import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ReminderEmailStatus } from "@/generated/prisma/client";
import { dateOnly, formatDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

const jobStatusLabels = { RUNNING: "กำลังทำงาน", SUCCESS: "สำเร็จ", ERROR: "ผิดพลาด" };
const emailStatusLabels: Record<ReminderEmailStatus, string> = {
  NOT_QUEUED: "ยังไม่ได้ตั้งค่าเมล",
  PENDING: "รอส่ง",
  SENDING: "กำลังส่ง",
  SENT: "ส่งแล้ว",
  ERROR: "ส่งไม่สำเร็จ",
  SKIPPED: "ยกเลิกการส่ง",
};

function emailStatusClass(status: ReminderEmailStatus): string {
  if (status === ReminderEmailStatus.SENT) return "status-active";
  if (status === ReminderEmailStatus.ERROR) return "status-canceled";
  if (status === ReminderEmailStatus.PENDING || status === ReminderEmailStatus.SENDING) return "status-paused";
  return "status-neutral";
}

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const db = getPrisma();
  const [reminders, jobs] = await Promise.all([
    db.reminder.findMany({ include: { subscription: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.jobExecution.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);

  return <AppShell email={session.user.email} active="activity">
    <header className="page-header">
      <div><p className="eyebrow">HISTORY &amp; SYSTEM</p><h1>ประวัติและระบบ</h1><p className="muted">ประวัติการแจ้งเตือนในเว็บ อีเมล และการทำงานของระบบ</p></div>
    </header>
    <section className="panel subscription-panel">
      <div className="panel-heading"><div><h2>ประวัติการแจ้งเตือน</h2><p className="muted">แสดงรายการล่าสุดไม่เกิน 50 รายการ</p></div></div>
      {reminders.length === 0 ? <p className="empty-note">ยังไม่มีประวัติการแจ้งเตือน</p> : <div className="table-wrap"><table className="subscription-table activity-table"><thead><tr><th>บริการ</th><th>วันครบกำหนด</th><th>แจ้งล่วงหน้า</th><th>อีเมล</th><th>สร้างเมื่อ</th><th>สถานะในเว็บ</th></tr></thead><tbody>{reminders.map((reminder) => <tr key={reminder.id}>
        <td>{reminder.subscription.name}</td>
        <td>{formatDate(dateOnly(reminder.dueDate))}</td>
        <td>{reminder.daysBefore} วัน</td>
        <td><span className={`status-badge ${emailStatusClass(reminder.emailStatus)}`}><i />{emailStatusLabels[reminder.emailStatus]}</span>{reminder.emailErrorCode && <small className="email-error-code">{reminder.emailErrorCode}</small>}</td>
        <td>{formatDate(reminder.createdAt)}</td>
        <td><span className={`status-badge ${reminder.status === "UNREAD" ? "status-paused" : "status-active"}`}><i />{reminder.status === "UNREAD" ? "ยังไม่อ่าน" : "อ่านแล้ว"}</span></td>
      </tr>)}</tbody></table></div>}
    </section>
    <section className="panel subscription-panel activity-jobs">
      <div className="panel-heading"><div><h2>ประวัติการทำงาน</h2><p className="muted">ผลการสร้างการแจ้งเตือนและการส่งอีเมล</p></div></div>
      {jobs.length === 0 ? <p className="empty-note">Cron ยังไม่ทำงานใน environment นี้</p> : <div className="job-list">{jobs.map((job) => <article className="job-row" key={job.id}>
        <div className="job-main"><span className={`status-badge ${job.status === "ERROR" ? "status-canceled" : job.status === "SUCCESS" ? "status-active" : "status-paused"}`}><i />{jobStatusLabels[job.status]}</span><strong>{job.jobName}</strong><span className="muted">{formatDate(job.startedAt)} · เพิ่ม {job.createdCount} รายการ</span></div>
        {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
      </article>)}</div>}
    </section>
  </AppShell>;
}
