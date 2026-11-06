import Link from "next/link";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, FolderIcon, PlusIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getPrisma } from "@/lib/prisma";
import { appDateString, formatDate, dateOnly, utcDate } from "@/lib/dates";

function selectedMonth(value: string | string[] | undefined, today: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return today.slice(0, 7);
  return value;
}

function monthTitle(month: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

export default async function SlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; drive?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const query = await searchParams;

  const monthLabel = selectedMonth(query.month, appDateString());
  const [selectedYear, selectedMonthNumber] = monthLabel.split("-").map(Number);
  const monthStart = utcDate(`${monthLabel}-01`);
  const monthEnd = new Date(Date.UTC(selectedYear, selectedMonthNumber, 0));

  const prisma = getPrisma();

  const [driveConnection, slips] = await Promise.all([
    prisma.driveConnection.findUnique({ where: { id: "default" }, select: { id: true } }),
    prisma.expenseSlip.findMany({
      where: {
        paidDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        subscription: { select: { id: true, name: true } },
      },
      orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const isConnected = !!driveConnection;

  // Totals by currency
  const totals: Record<string, number> = {};
  for (const slip of slips) {
    const amount = Number(slip.amount);
    totals[slip.currency] = (totals[slip.currency] ?? 0) + amount;
  }

  // Build prev/next month links
  const prevDate = new Date(Date.UTC(selectedYear, selectedMonthNumber - 2, 1));
  const nextDate = new Date(Date.UTC(selectedYear, selectedMonthNumber, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <AppShell email={session.user.email} active="slips">
      <header className="page-header">
        <div>
          <p className="eyebrow">EXPENSE SLIPS</p>
          <h1>สลิปค่าใช้จ่าย</h1>
          <p className="muted">
            บันทึกและจัดการสลิปการชำระเงินของคุณ
            {isConnected && (
              <>
                {" · "}
                <Link className="text-link" href="/api/drive/connect">
                  เชื่อมต่อ Google Drive ใหม่
                </Link>
              </>
            )}
          </p>
        </div>
        <Link className="button button-primary" href="/slips/new">
          <PlusIcon aria-hidden /> เพิ่มสลิป
        </Link>
      </header>

      {query.drive === "connected" && (
        <div className="success-banner stack-gap">
          เชื่อมต่อ Google Drive สำเร็จแล้ว
        </div>
      )}
      {query.drive === "error" && (
        <div className="error-banner stack-gap">
          เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive กรุณาลองใหม่อีกครั้ง
        </div>
      )}

      {!isConnected && (
        <div className="empty-callout stack-gap">
          <div className="empty-icon"><FolderIcon aria-hidden /></div>
          <div>
            <strong>ยังไม่ได้เชื่อมต่อ Google Drive</strong>
            <p>
              สลิปจะถูกเก็บในไฟล์ Google Drive ของคุณ{" "}
              <Link className="text-link" href="/api/drive/connect">
                เชื่อมต่อ Google Drive <ArrowRightIcon aria-hidden />
              </Link>
            </p>
          </div>
        </div>
      )}

      <section className="panel stack-gap">
        <div className="panel-heading">
          <div>
            <h2>
              เดือน{monthTitle(monthLabel)}{" "}
              <span className="subtle-count">({slips.length} รายการ)</span>
            </h2>
            {Object.keys(totals).length > 0 && (
              <p className="muted slip-total">
                รวม:{" "}
                {Object.entries(totals)
                  .map(([cur, amt]) => `${amt.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="month-switcher">
            <Link className="button button-secondary button-sm" href={`/slips?month=${prevMonth}`}>
              <CaretLeftIcon aria-hidden />
            </Link>
            <span className="month-indicator">{monthTitle(monthLabel)}</span>
            <Link className="button button-secondary button-sm" href={`/slips?month=${nextMonth}`}>
              <CaretRightIcon aria-hidden />
            </Link>
          </div>
        </div>

        {slips.length === 0 ? (
          <div className="empty-note large-empty">
            ยังไม่มีสลิปในเดือนนี้{" "}
            <Link className="text-link" href="/slips/new">
              เพิ่มสลิปแรก <ArrowRightIcon aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="slip-list">
            {slips.map((slip) => (
              <div className="slip-row" key={slip.id}>
                <div className="slip-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/slips/${slip.id}/image`}
                    alt={slip.fileName}
                    loading="lazy"
                    className="slip-thumb-img"
                  />
                </div>
                <div className="slip-info">
                  <strong>
                    {slip.payee || "ไม่ระบุผู้รับเงิน"}
                  </strong>
                  <small>
                    {formatDate(dateOnly(slip.paidDate))}
                    {slip.paidTime ? ` ${slip.paidTime} น.` : ""}
                    {" · "}
                    {slip.category}
                    {slip.subscription ? ` · ${slip.subscription.name}` : ""}
                  </small>
                </div>
                <div className="slip-amount">
                  {Number(slip.amount).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {slip.currency}
                </div>
                <Link className="text-link" href={`/slips/${slip.id}`}>
                  รายละเอียด <ArrowRightIcon aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
