// The owner's own monthly budget items (2026-11-10), plus อื่นๆ as the catch-all with no budget.
export type ExpenseCategoryKey =
  | "food"
  | "rent"
  | "fuel"
  | "internet"
  | "laundry"
  | "savings"
  | "utilities"
  | "stocks"
  | "emergency"
  | "bills"
  | "subs"
  | "other";

export type ExpenseCategory = {
  key: ExpenseCategoryKey;
  label: string;
  emoji: string;
};

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  { key: "food", label: "ค่ากิน", emoji: "🍔" },
  { key: "rent", label: "ค่าห้อง", emoji: "🏠" },
  { key: "fuel", label: "ค่าน้ำมัน", emoji: "⛽" },
  { key: "internet", label: "ค่าเน็ต", emoji: "🌐" },
  { key: "laundry", label: "ค่าซักผ้า", emoji: "🧺" },
  { key: "savings", label: "เงินเก็บ", emoji: "🐷" },
  { key: "utilities", label: "ค่าน้ำค่าไฟ", emoji: "💡" },
  { key: "stocks", label: "หุ้น", emoji: "📈" },
  { key: "emergency", label: "ฉุกเฉิน", emoji: "🚨" },
  { key: "bills", label: "จ่ายบิล", emoji: "🧾" },
  { key: "subs", label: "บิลรายเดือน", emoji: "📅" },
  { key: "other", label: "อื่นๆ", emoji: "📦" },
] as const;

/**
 * Category names used before 2026-11-10, so rows saved under them still count somewhere.
 * Rows were also moved in the database, so these matter only for stray values.
 */
const LEGACY_CATEGORIES: Readonly<Record<string, ExpenseCategoryKey>> = {
  "อาหาร": "food",
  "เดินทาง": "fuel",
  transport: "fuel",
  "ช้อปปิ้ง": "other",
  shopping: "other",
  "บิลและค่าบริการ": "bills",
  "บันเทิง": "other",
  fun: "other",
  "สุขภาพ": "other",
  health: "other",
};

export function categoryLabel(key: string): string | null {
  const match = EXPENSE_CATEGORIES.find((item) => item.key === key);
  return match ? match.label : null;
}

/**
 * Rows store a key (`food`) from older web entries or a Thai label (`ค่ากิน`). Old names map to
 * their nearest new category; anything else counts as `other`.
 */
export function categoryKeyFor(value: string): ExpenseCategoryKey {
  return matchCategoryKey(value) ?? "other";
}

/** The category a stored value names, or null for free text that names none. */
export function matchCategoryKey(value: string): ExpenseCategoryKey | null {
  const text = value.trim();
  const match = EXPENSE_CATEGORIES.find((item) => item.key === text.toLowerCase() || item.label === text);
  return match?.key ?? LEGACY_CATEGORIES[text] ?? LEGACY_CATEGORIES[text.toLowerCase()] ?? null;
}
