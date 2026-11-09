import type { BudgetLine, BudgetMap } from "@/lib/budget";
import { categoryEmoji } from "@/lib/dashboard";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

function baht(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const levelNote = { ok: "", warn: "ใกล้เต็มงบ", over: "เกินงบ" } as const;

/** Fixed costs such as rent are paid in full, which is on plan rather than a warning. */
function isExactlyUsed(line: BudgetLine): boolean {
  return Math.round(line.spent * 100) === Math.round(line.budget * 100);
}

function BudgetRow({ line }: { line: BudgetLine }) {
  const exact = isExactlyUsed(line);
  const note = exact ? "ครบงบ" : levelNote[line.level];
  return (
    <li className={`budget-row budget-${exact ? "exact" : line.level}`}>
      <div className="budget-row-head">
        <span className="budget-name">{categoryEmoji(line.key)} {line.label}</span>
        <span className="budget-figures">
          {note && <b>{note} · </b>}
          ฿{baht(line.spent)} / ฿{baht(line.budget)}
        </span>
      </div>
      <div
        className="budget-bar"
        role="progressbar"
        aria-label={`งบ${line.label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(line.share * 100))}
      >
        <span style={{ width: `${Math.min(100, line.share * 100)}%` }} />
      </div>
      <small className="muted">
        {line.spent > line.budget
          ? `เกินมา ฿${baht(line.spent - line.budget)}`
          : `เหลือ ฿${baht(line.budget - line.spent)} (${Math.round(line.share * 100)}%)`}
      </small>
    </li>
  );
}

/** Monthly budgets per category, with a fold-out form to set them. */
export function BudgetPanel({
  lines,
  budgets,
  month,
  action,
  className = "",
}: {
  className?: string;
  lines: readonly BudgetLine[];
  budgets: BudgetMap;
  month: string;
  action: (formData: FormData) => Promise<void>;
}) {
  // Categories with no spending yet (often savings set aside later) fold away to keep the card short.
  const active = lines.filter((line) => line.spent > 0);
  const unused = lines.filter((line) => line.spent <= 0);
  const totalBudget = lines.reduce((sum, line) => sum + line.budget, 0);
  const totalSpent = lines.reduce((sum, line) => sum + line.spent, 0);
  const totalShare = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const totalLevel = totalSpent > totalBudget ? "over" : totalShare >= 0.8 ? "warn" : "ok";

  return (
    <section className={`panel ${className}`.trim()} aria-labelledby="budget-title">
      <div className="card-heading card-heading-stack">
        <h2 id="budget-title" className="card-title">งบรายเดือน <span aria-hidden>🎯</span></h2>
        <p className="muted card-note">เตือนใน Telegram ที่ 80% และเมื่อเกินงบ</p>
      </div>

      {lines.length === 0 ? (
        <p className="empty-note">ยังไม่ได้ตั้งงบ กด &quot;ตั้งงบ&quot; ด้านล่างเพื่อเริ่ม</p>
      ) : (
        <>
          <div className={`budget-total budget-${totalLevel}`}>
            <div className="budget-total-figures">
              <span>ใช้ไปทั้งหมด</span>
              <strong>฿{baht(totalSpent)}</strong>
              <span className="muted">จาก ฿{baht(totalBudget)} ({Math.round(totalShare * 100)}%)</span>
            </div>
            <div className="budget-bar" aria-hidden>
              <span style={{ width: `${Math.min(100, totalShare * 100)}%` }} />
            </div>
          </div>

          {active.length > 0 && (
            <ul className="budget-list">
              {active.map((line) => <BudgetRow line={line} key={line.key} />)}
            </ul>
          )}

          {unused.length > 0 && (
            <details className="budget-unused">
              <summary>ยังไม่ได้ใช้ ({unused.length} หมวด · ฿{baht(unused.reduce((sum, line) => sum + line.budget, 0))})</summary>
              <ul className="budget-list">
                {unused.map((line) => <BudgetRow line={line} key={line.key} />)}
              </ul>
            </details>
          )}
        </>
      )}

      <details className="budget-edit">
        <summary>ตั้งงบ</summary>
        <form action={action} className="budget-form">
          <input type="hidden" name="month" value={month} />
          {EXPENSE_CATEGORIES.map((category) => (
            <label className="field" key={category.key}>
              <span>{categoryEmoji(category.key)} {category.label}</span>
              <input
                name={`budget_${category.key}`}
                inputMode="decimal"
                pattern="[\d,]+(\.\d{1,2})?"
                placeholder="ไม่ตั้งงบ"
                defaultValue={budgets[category.key] ?? ""}
              />
            </label>
          ))}
          <p className="muted budget-form-note">ใส่เป็นบาทต่อเดือน เว้นว่างถ้าไม่ต้องการตั้งงบหมวดนั้น</p>
          <button className="button button-primary" type="submit">บันทึกงบ</button>
        </form>
      </details>
    </section>
  );
}
