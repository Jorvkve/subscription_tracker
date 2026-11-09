import Link from "next/link";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, FolderIcon, PlusIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { quickAddExpense, saveBudgets } from "@/app/slips/actions";
import { AppShell } from "@/components/app-shell";
import { BudgetPanel } from "@/components/budget-panel";
import { budgetLines, sumByCategory } from "@/lib/budget";
import { loadBudgets } from "@/lib/budget-data";
import { HeroHeader, firstName } from "@/components/hero-header";
import { SpendDonut } from "@/components/spend-donut";
import { categoryEmoji, monthKeys, relativeDayLabel, spendByCategory } from "@/lib/dashboard";
import { appDateString, dateOnly, formatDate, utcDate } from "@/lib/dates";
import { money } from "@/lib/display";
import { EXPENSE_CATEGORIES, categoryLabel } from "@/lib/expense-categories";
import { getPrisma } from "@/lib/prisma";

/** Rows shown before "ดูอีก" on the month's list; the rest fold away to keep the page short. */
const RECENT_VISIBLE = 8;

function selectedMonth(value: string | string[] | undefined, today: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return today.slice(0, 7);
  return value;
}

function monthTitle(month: string, format: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: format,
    ...(format === "long" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function lastDayOf(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0));
}

export default async function SlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; drive?: string | string[]; quick?: string | string[]; budget?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const query = await searchParams;
  const today = appDateString();
  const monthLabel = selectedMonth(query.month, today);
  const trendMonths = monthKeys(monthLabel, 6);

  const prisma = getPrisma();
  const [driveConnection, slips, trendSlips, budgets] = await Promise.all([
    prisma.driveConnection.findUnique({ where: { id: "default" }, select: { id: true } }),
    prisma.expenseSlip.findMany({
      where: { paidDate: { gte: utcDate(`${monthLabel}-01`), lte: lastDayOf(monthLabel) } },
      include: { subscription: { select: { id: true, name: true } } },
      orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expenseSlip.findMany({
      where: { currency: "THB", paidDate: { gte: utcDate(`${trendMonths[0]}-01`), lte: lastDayOf(monthLabel) } },
      select: { amount: true, paidDate: true },
    }),
    loadBudgets(),
  ]);

  const isConnected = !!driveConnection;

  const totals: Record<string, number> = {};
  for (const slip of slips) totals[slip.currency] = (totals[slip.currency] ?? 0) + Number(slip.amount);
  const thbTotal = totals.THB ?? 0;
  const otherTotals = Object.entries(totals).filter(([currency]) => currency !== "THB");
  const categories = spendByCategory(
    slips.filter((slip) => slip.currency === "THB").map((slip) => ({ category: slip.category, amount: Number(slip.amount) })),
  );
  const budgetRows = budgetLines(
    budgets,
    sumByCategory(slips.filter((slip) => slip.currency === "THB").map((slip) => ({ category: slip.category, amount: Number(slip.amount) }))),
  );
  const daysCounted = monthLabel === today.slice(0, 7) ? Number(today.slice(8)) : lastDayOf(monthLabel).getUTCDate();

  const trend = trendMonths.map((month) => ({ month, amount: 0 }));
  for (const slip of trendSlips) {
    const entry = trend.find((item) => item.month === dateOnly(slip.paidDate).slice(0, 7));
    if (entry) entry.amount += Number(slip.amount);
  }
  const trendMax = Math.max(...trend.map((item) => item.amount), 1);

  const [selectedYear, selectedMonthNumber] = monthLabel.split("-").map(Number);
  const prevDate = new Date(Date.UTC(selectedYear, selectedMonthNumber - 2, 1));
  const nextDate = new Date(Date.UTC(selectedYear, selectedMonthNumber, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const renderSlip = (slip: (typeof slips)[number]) => {
    const paid = dateOnly(slip.paidDate);
    return (
      <li key={slip.id}>
        <Link className="tx-row" href={`/slips/${slip.id}`}>
          <span className="tx-date">{relativeDayLabel(paid, today) ?? formatDate(paid)}</span>
          <span className="tx-thumb" aria-hidden>
            {slip.driveFileId
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/slips/${slip.id}/image`} alt="" loading="lazy" />
              : <span>{categoryEmoji(slip.category)}</span>}
          </span>
          <span className="tx-main">
            <strong>{slip.payee || slip.note || "ไม่ระบุผู้รับเงิน"}</strong>
            <small>
              {categoryLabel(slip.category) ?? slip.category}
              {slip.paidTime ? ` · ${slip.paidTime} น.` : ""}
              {slip.source === "TELEGRAM" ? " · Telegram" : ""}
              {slip.subscription ? ` · ${slip.subscription.name}` : ""}
            </small>
          </span>
          <span className="tx-amount">- {money(Number(slip.amount), slip.currency)}</span>
        </Link>
      </li>
    );
  };

  return (
    <AppShell email={session.user.email} active="slips">
      <HeroHeader title="Money" accent="Tracker" name={firstName(session.user)} tagline="มาเช็กกระแสเงินกันหน่อย 💸">
        <Link className="button button-primary" href="/slips/new"><PlusIcon aria-hidden /> เพิ่มสลิป</Link>
        {isConnected && <Link className="button button-secondary" href="/api/drive/connect">เชื่อมต่อ Google Drive ใหม่</Link>}
      </HeroHeader>

      {query.drive === "connected" && <div className="success-banner stack-gap">เชื่อมต่อ Google Drive สำเร็จแล้ว</div>}
      {query.drive === "error" && <div className="error-banner stack-gap">เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive กรุณาลองใหม่อีกครั้ง</div>}
      {query.quick === "saved" && <div className="success-banner stack-gap">บันทึกรายจ่ายแล้ว 🎉</div>}
      {query.budget === "saved" && <div className="success-banner stack-gap">บันทึกงบแล้ว 🎯</div>}
      {query.budget === "error" && <div className="error-banner stack-gap">บันทึกงบไม่สำเร็จ ใส่ตัวเลขเป็นบาท เช่น 3000</div>}
      {query.quick === "error" && <div className="error-banner stack-gap">บันทึกไม่สำเร็จ ตรวจสอบจำนวนเงินแล้วลองใหม่อีกครั้ง</div>}

      {!isConnected && (
        <div className="empty-callout stack-gap">
          <div className="empty-icon"><FolderIcon aria-hidden /></div>
          <div>
            <strong>ยังไม่ได้เชื่อมต่อ Google Drive</strong>
            <p>
              สลิปจะถูกเก็บในไฟล์ Google Drive ของคุณ{" "}
              <Link className="text-link" href="/api/drive/connect">เชื่อมต่อ Google Drive <ArrowRightIcon aria-hidden /></Link>
            </p>
          </div>
        </div>
      )}

      <div className="money-grid">
        {/* Desktop: overview on the left, actions on the right. Phones reorder these with CSS. */}
        <div className="money-col">
          <section className="panel money-total m-total" aria-labelledby="money-total-title">
            <div className="card-heading">
              <h2 id="money-total-title" className="card-title">ใช้ไปเดือนนี้ <span className="card-title-sub">({monthTitle(monthLabel)})</span></h2>
              <nav className="month-switcher" aria-label="เปลี่ยนเดือน">
                <Link className="calendar-nav-button" href={`/slips?month=${prevMonth}`} aria-label="เดือนก่อนหน้า"><CaretLeftIcon aria-hidden /></Link>
                <Link className="calendar-nav-button" href={`/slips?month=${nextMonth}`} aria-label="เดือนถัดไป"><CaretRightIcon aria-hidden /></Link>
              </nav>
            </div>
            <div className="money-total-body">
              <div>
                <strong className="big-number">{money(thbTotal, "THB")}</strong>
                {otherTotals.map(([currency, amount]) => <span className="big-number-extra" key={currency}>+ {money(amount, currency)}</span>)}
                <p className="muted dash-line">
                  {slips.length} รายการ · เฉลี่ย {money(thbTotal / daysCounted, "THB")} / วัน
                </p>
              </div>
              <span className="money-bag" aria-hidden>💰</span>
            </div>
          </section>

          <BudgetPanel className="m-budget" lines={budgetRows} budgets={budgets} month={monthLabel} action={saveBudgets} />

          <section className="panel m-donut" aria-labelledby="where-title">
            <div className="card-heading">
              <h2 id="where-title" className="card-title">เงินหายไปไหน? <span aria-hidden>🤔</span></h2>
            </div>
            {categories.length === 0
              ? <p className="empty-note">ยังไม่มีรายจ่ายในเดือนนี้ <span aria-hidden>😴</span></p>
              : <SpendDonut categories={categories} emoji className="donut-side" />}
          </section>
        </div>

        <div className="money-col">
          <section className="panel m-quick" aria-labelledby="quick-title">
            <div className="card-heading">
              <h2 id="quick-title" className="card-title">บันทึกด่วน <span aria-hidden>⚡</span></h2>
              <span className="muted card-note">วันนี้ · ไม่ต้องมีรูปสลิป</span>
            </div>
            <form className="quick-add" action={quickAddExpense}>
              <fieldset className="chip-options">
                <legend className="sr-only">หมวดหมู่</legend>
                {EXPENSE_CATEGORIES.map((category, index) => (
                  <label className="chip-option" key={category.key}>
                    <input type="radio" name="category" value={category.key} defaultChecked={index === 0} />
                    <span>{category.label} {categoryEmoji(category.key)}</span>
                  </label>
                ))}
              </fieldset>
              <div className="quick-add-row">
                <label className="field">
                  <span className="sr-only">รายการ</span>
                  <input name="payee" maxLength={200} placeholder="รายการ เช่น ข้าวมันไก่" />
                </label>
                <label className="field quick-amount">
                  <span className="sr-only">จำนวนเงิน (บาท)</span>
                  <input name="amount" inputMode="decimal" pattern="\d+(\.\d{1,2})?" required placeholder="฿ 0.00" />
                </label>
                <button className="button button-primary" type="submit">บันทึก</button>
              </div>
            </form>
          </section>

          <section className="panel m-tx" aria-labelledby="tx-title">
            <div className="card-heading">
              <h2 id="tx-title" className="card-title">รายการล่าสุด <span className="card-title-sub">({slips.length})</span></h2>
            </div>
            {slips.length === 0 ? (
              <div className="empty-note">
                ยังไม่มีสลิปในเดือนนี้{" "}
                <Link className="text-link" href="/slips/new">เพิ่มสลิปแรก <ArrowRightIcon aria-hidden /></Link>
              </div>
            ) : (
              <>
                <ul className="tx-list">{slips.slice(0, RECENT_VISIBLE).map(renderSlip)}</ul>
                {slips.length > RECENT_VISIBLE && (
                  <details className="tx-more">
                    <summary>ดูอีก {slips.length - RECENT_VISIBLE} รายการ</summary>
                    <ul className="tx-list">{slips.slice(RECENT_VISIBLE).map(renderSlip)}</ul>
                  </details>
                )}
              </>
            )}
          </section>

          <section className="panel m-trend" aria-labelledby="trend-title">
            <div className="card-heading">
              <h2 id="trend-title" className="card-title">รายจ่าย 6 เดือน <span className="card-title-sub">(บาท)</span></h2>
            </div>
            <ol className="bar-chart">
              {trend.map((item) => (
                <li key={item.month} className={item.month === monthLabel ? "bar-current" : undefined} aria-label={`${monthTitle(item.month)} ${money(item.amount, "THB")}`}>
                  <span className="bar-value">{item.amount > 0 ? Math.round(item.amount).toLocaleString("th-TH") : "–"}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ height: `${Math.max((item.amount / trendMax) * 100, item.amount > 0 ? 4 : 0)}%` }} /></span>
                  <span className="bar-label">{monthTitle(item.month, "short")}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
