import type { BudgetLine, BudgetMap } from "@/lib/budget";
import { categoryEmoji } from "@/lib/dashboard";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

function baht(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const levelNote = { ok: "", warn: "ใกล้เต็มงบ", over: "เกินงบ" } as const;

/** Monthly budgets per category, with a fold-out form to set them. */
export function BudgetPanel({
  lines,
  budgets,
  month,
  action,
}: {
  lines: readonly BudgetLine[];
  budgets: BudgetMap;
  month: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="panel" aria-labelledby="budget-title">
      <div className="card-heading">
        <h2 id="budget-title" className="card-title">งบรายเดือน <span aria-hidden>🎯</span></h2>
        <span className="muted card-note">เตือนใน Telegram ที่ 80% และเมื่อเกินงบ</span>
      </div>

      {lines.length === 0 ? (
        <p className="empty-note">ยังไม่ได้ตั้งงบ กด &quot;ตั้งงบ&quot; ด้านล่างเพื่อเริ่ม</p>
      ) : (
        <ul className="budget-list">
          {lines.map((line) => (
            <li className={`budget-row budget-${line.level}`} key={line.key}>
              <div className="budget-row-head">
                <span>{categoryEmoji(line.key)} {line.label}</span>
                <span className="budget-figures">
                  {levelNote[line.level] && <b>{levelNote[line.level]} · </b>}
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
          ))}
        </ul>
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
