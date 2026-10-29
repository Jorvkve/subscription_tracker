import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteSubscription, markPaid } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DeleteSubscriptionButton } from "@/components/delete-subscription-button";
import { dateOnly, formatDate } from "@/lib/dates";
import { cycleName, money } from "@/lib/display";
import { getPrisma } from "@/lib/prisma";

const statusLabels = { ACTIVE: "กำลังใช้งาน", PAUSED: "พักชำระ", CANCELED: "ยกเลิกแล้ว" };

export default async function SubscriptionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const subscription = await getPrisma().subscription.findUnique({ where: { id }, include: { payments: { orderBy: { paidAt: "desc" }, take: 12 } } });
  if (!subscription) notFound();
  const deleteAction = deleteSubscription.bind(null, id);
  const payAction = markPaid.bind(null, id);

  return <AppShell email={session.user.email} active="subscriptions"><header className="page-header detail-header"><div><Link className="back-link" href="/subscriptions">← รายการ Subscription</Link><div className="detail-title"><span className={`service-avatar avatar-${subscription.name.charCodeAt(0) % 5} large-avatar`}>{subscription.name.slice(0, 1).toUpperCase()}</span><div><p className="eyebrow">{subscription.category}</p><h1>{subscription.name}</h1></div></div></div><div className="header-actions"><Link className="button button-secondary" href={`/subscriptions/${id}/edit`}>แก้ไข</Link><DeleteSubscriptionButton action={deleteAction}/></div></header>
    {query.paid && <div className="success-banner">บันทึกการจ่ายแล้ว และเลื่อนวันครบกำหนดรอบถัดไปเรียบร้อย</div>}
    {query.error === "payment" && <div className="error-banner">บันทึกการชำระไม่สำเร็จ อาจมีการบันทึกรอบนี้ไปแล้ว กรุณาตรวจประวัติการชำระ</div>}
    <div className="detail-grid"><section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">SUBSCRIPTION DETAILS</p><h2>รายละเอียดบริการ</h2></div><span className={`status-badge status-${subscription.status.toLowerCase()}`}><i/> {statusLabels[subscription.status]}</span></div><dl className="detail-list"><div><dt>ราคา / รอบบิล</dt><dd className="highlight-value">{money(Number(subscription.price), subscription.currency)}</dd></div><div><dt>รอบบิล</dt><dd>{cycleName(subscription.intervalCount, subscription.intervalUnit)}</dd></div><div><dt>วันตัดรอบ</dt><dd>{subscription.billingDay ?? "ไม่ได้ระบุ"}</dd></div><div><dt>ครบกำหนดรอบถัดไป</dt><dd className="highlight-value">{formatDate(dateOnly(subscription.nextDueDate))}</dd></div><div><dt>วิธีชำระเงิน</dt><dd>{subscription.paymentMethod || "ไม่ได้ระบุ"}</dd></div><div><dt>บันทึก</dt><dd>{subscription.notes || "ไม่มีบันทึก"}</dd></div></dl>{subscription.status === "ACTIVE" && <form action={payAction} className="pay-action"><div><strong>ชำระเงินแล้ว?</strong><p>การกดบันทึกจะเพิ่มประวัติการจ่าย และเลื่อนกำหนดไปอีก {cycleName(subscription.intervalCount, subscription.intervalUnit)}</p></div><button className="button button-primary" type="submit">✓ บันทึกว่าจ่ายแล้ว</button></form>}</section>
    <section className="panel payment-panel"><div className="panel-heading"><div><p className="eyebrow">PAYMENT HISTORY</p><h2>ประวัติการชำระ</h2></div><span className="count-pill">{subscription.payments.length}</span></div>{subscription.payments.length === 0 ? <p className="empty-note">ยังไม่มีประวัติการชำระ</p> : <div className="payment-list">{subscription.payments.map((payment) => <div className="payment-row" key={payment.id}><span className="payment-check">✓</span><div><strong>{formatDate(payment.paidAt)}</strong><small>รอบที่ครบกำหนด {formatDate(dateOnly(payment.coveredDueDate))}</small></div><strong>{money(Number(payment.amount), payment.currency)}</strong></div>)}</div>}</section></div>
  </AppShell>;
}
