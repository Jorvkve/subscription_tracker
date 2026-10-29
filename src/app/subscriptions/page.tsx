import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { dateOnly, formatDate } from "@/lib/dates";
import { cycleName, money } from "@/lib/display";

const statusLabels = { ACTIVE: "กำลังใช้งาน", PAUSED: "พักชำระ", CANCELED: "ยกเลิกแล้ว" };

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const subscriptions = await getPrisma().subscription.findMany({ orderBy: [{ status: "asc" }, { nextDueDate: "asc" }] });

  return (
    <AppShell email={session.user.email} active="subscriptions">
      <header className="page-header"><div><p className="eyebrow">YOUR SERVICES</p><h1>รายการ Subscription</h1><p className="muted">จัดการบริการ รอบบิล และวันครบกำหนดของคุณ</p></div><Link className="button button-primary" href="/subscriptions/new">＋ เพิ่มรายการ</Link></header>
      <section className="panel subscription-panel">
        <div className="panel-heading"><div><h2>ทั้งหมด <span className="subtle-count">{subscriptions.length}</span></h2><p className="muted">วันที่ครบกำหนดจะเปลี่ยนเมื่อคุณบันทึกการชำระเงิน</p></div></div>
        {subscriptions.length === 0 ? <div className="empty-note large-empty">ยังไม่มี Subscription <Link className="text-link" href="/subscriptions/new">เพิ่มรายการแรกของคุณ →</Link></div> : <div className="table-wrap"><table className="subscription-table"><thead><tr><th>บริการ</th><th>รอบบิล</th><th>ราคา</th><th>วันครบกำหนด</th><th>สถานะ</th><th><span className="sr-only">เปิดรายละเอียด</span></th></tr></thead><tbody>{subscriptions.map((subscription) => <tr key={subscription.id}><td><Link className="table-service" href={`/subscriptions/${subscription.id}`}><span className={`service-avatar avatar-${subscription.name.charCodeAt(0) % 5}`}>{subscription.name.slice(0, 1).toUpperCase()}</span><span><strong>{subscription.name}</strong><small>{subscription.category}</small></span></Link></td><td>{cycleName(subscription.intervalCount, subscription.intervalUnit)}</td><td className="table-money">{money(Number(subscription.price), subscription.currency)}</td><td>{formatDate(dateOnly(subscription.nextDueDate))}</td><td><span className={`status-badge status-${subscription.status.toLowerCase()}`}><i/> {statusLabels[subscription.status]}</span></td><td><Link className="text-link" href={`/subscriptions/${subscription.id}`}>รายละเอียด →</Link></td></tr>)}</tbody></table></div>}
      </section>
    </AppShell>
  );
}
