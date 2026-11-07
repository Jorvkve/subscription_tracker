export type ExpenseCategoryKey =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "fun"
  | "health"
  | "other";

export type ExpenseCategory = {
  key: ExpenseCategoryKey;
  label: string;
};

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  { key: "food", label: "อาหาร" },
  { key: "transport", label: "เดินทาง" },
  { key: "shopping", label: "ช้อปปิ้ง" },
  { key: "bills", label: "บิลและค่าบริการ" },
  { key: "fun", label: "บันเทิง" },
  { key: "health", label: "สุขภาพ" },
  { key: "other", label: "อื่นๆ" },
] as const;

export function categoryLabel(key: string): string | null {
  const match = EXPENSE_CATEGORIES.find((item) => item.key === key);
  return match ? match.label : null;
}
