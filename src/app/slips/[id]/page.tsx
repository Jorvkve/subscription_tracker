import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SlipForm } from "@/components/slip-form";
import { DeleteSlipButton } from "@/components/delete-slip-button";
import { deleteSlip, updateSlip } from "@/app/slips/actions";
import { getPrisma } from "@/lib/prisma";
import { dateOnly, formatDate } from "@/lib/dates";

export default async function SlipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const { id } = await params;

  const prisma = getPrisma();
  const slip = await prisma.expenseSlip.findUnique({
    where: { id },
    include: { subscription: { select: { id: true, name: true } } },
  });

  if (!slip) notFound();

  // Keep the linked subscription selectable even if it is no longer active,
  // otherwise saving the form would silently clear the link.
  const subscriptions = await prisma.subscription.findMany({
    where: slip.subscriptionId
      ? { OR: [{ status: "ACTIVE" }, { id: slip.subscriptionId }] }
      : { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const deleteAction = deleteSlip.bind(null, id);
  const updateAction = updateSlip.bind(null, id);

  const values = {
    amount: String(Number(slip.amount)),
    currency: slip.currency,
    paidDate: dateOnly(slip.paidDate),
    paidTime: slip.paidTime,
    payee: slip.payee,
    category: slip.category,
    note: slip.note,
    subscriptionId: slip.subscriptionId,
  };

  return (
    <AppShell email={session.user.email} active="slips">
      <header className="page-header detail-header">
        <div>
          <Link className="back-link" href="/slips">
            ← สลิปค่าใช้จ่าย
          </Link>
          <div className="detail-title">
            <div>
              <p className="eyebrow">{slip.category}</p>
              <h1>{slip.payee || "สลิปการชำระเงิน"}</h1>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <DeleteSlipButton action={deleteAction} />
        </div>
      </header>

      <div className="detail-grid">
        <section className="panel detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SLIP IMAGE</p>
              <h2>รูปสลิป</h2>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/slips/${id}/image`}
            alt={slip.fileName}
            style={{
              maxWidth: "100%",
              borderRadius: "8px",
              border: "1px solid var(--line)",
            }}
          />
          <dl className="detail-list" style={{ marginTop: "16px" }}>
            <div>
              <dt>ชื่อไฟล์</dt>
              <dd>{slip.fileName}</dd>
            </div>
            <div>
              <dt>ขนาดไฟล์</dt>
              <dd>{(slip.sizeBytes / 1024).toFixed(1)} KB</dd>
            </div>
            <div>
              <dt>วันที่ชำระ</dt>
              <dd className="highlight-value">
                {formatDate(dateOnly(slip.paidDate))}
                {slip.paidTime ? ` ${slip.paidTime} น.` : ""}
              </dd>
            </div>
            <div>
              <dt>จำนวนเงิน</dt>
              <dd className="highlight-value">
                {Number(slip.amount).toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {slip.currency}
              </dd>
            </div>
            <div>
              <dt>ผู้รับเงิน</dt>
              <dd>{slip.payee || "ไม่ระบุ"}</dd>
            </div>
            <div>
              <dt>หมวดหมู่</dt>
              <dd>{slip.category}</dd>
            </div>
            {slip.subscription && (
              <div>
                <dt>Subscription</dt>
                <dd>
                  <Link
                    className="text-link"
                    href={`/subscriptions/${slip.subscription.id}`}
                  >
                    {slip.subscription.name}
                  </Link>
                </dd>
              </div>
            )}
            {slip.note && (
              <div>
                <dt>บันทึก</dt>
                <dd>{slip.note}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="panel detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EDIT SLIP</p>
              <h2>แก้ไขรายละเอียด</h2>
            </div>
          </div>
          <SlipForm
            action={updateAction}
            values={values}
            subscriptions={subscriptions}
            showFileField={false}
          />
        </section>
      </div>
    </AppShell>
  );
}
