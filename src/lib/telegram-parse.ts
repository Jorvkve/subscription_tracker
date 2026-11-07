// Pure helpers for the Telegram bot: no Prisma, server-only, or network imports.
import { formatDate } from "@/lib/dates";
import { EXPENSE_CATEGORIES, categoryLabel } from "@/lib/expense-categories";

export type TgChat = { id: number; type: string };
export type TgPhotoSize = { file_id: string; file_size?: number; width: number; height: number };
export type TgDocument = { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
export type TgMessage = {
  message_id: number;
  chat: TgChat;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgDocument;
  reply_to_message?: TgMessage;
};
export type TgCallbackQuery = { id: string; data?: string; message?: TgMessage };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery };

export type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

export type ParsedExpense = { amount: number; note: string | null };

const MAX_AMOUNT = 1_000_000_000;
const MAX_NOTE_LENGTH = 200;

// An amount: optional ฿, digits with optional thousands commas, up to 2 decimals,
// then an optional บาท or บ. The lookarounds stop it matching inside 1e3 or 12.345.
const AMOUNT = String.raw`(?:฿\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(?:บาท|บ\.))?`;
const AMOUNT_AT_END = new RegExp(String.raw`^([\s\S]*?)(?<![\d.,A-Za-z])${AMOUNT}$`);
const AMOUNT_AT_START = new RegExp(String.raw`^${AMOUNT}(?![\d.,A-Za-z])([\s\S]*)$`);

export function normalizeThaiDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

function toAmount(integer: string, decimals: string | undefined): number | null {
  const amount = Number(`${integer.replace(/,/g, "")}${decimals ? `.${decimals}` : ""}`);
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT ? amount : null;
}

function toNote(text: string): string | null {
  const note = text.trim();
  return note ? note.slice(0, MAX_NOTE_LENGTH) : null;
}

/** Reads `ข้าว 60` or `60 กาแฟ`. When both ends are numbers, the end wins. */
export function parseExpenseText(input: string): ParsedExpense | null {
  const text = normalizeThaiDigits(input).trim();
  if (!text || text.startsWith("/")) return null;

  const end = AMOUNT_AT_END.exec(text);
  if (end) {
    const amount = toAmount(end[2], end[3]);
    if (amount !== null) return { amount, note: toNote(end[1]) };
  }
  const start = AMOUNT_AT_START.exec(text);
  if (start) {
    const amount = toAmount(start[1], start[2]);
    if (amount !== null) return { amount, note: toNote(start[3]) };
  }
  return null;
}

export type BotCommand = "start" | "help" | "today" | "month" | "undo";

export function parseCommand(text: string): BotCommand | null {
  const match = /^\/(start|help|today|month|undo)(?:@\w+)?(?:\s|$)/i.exec(text.trim());
  return match ? (match[1].toLowerCase() as BotCommand) : null;
}

const CALLBACK_PATTERN = /^cat:([a-z0-9]{20,32}):([a-z]{1,16})$/;

export function encodeCategoryCallback(expenseId: string, key: string): string {
  return `cat:${expenseId}:${key}`;
}

export function decodeCategoryCallback(data: string): { expenseId: string; key: string } | null {
  const match = CALLBACK_PATTERN.exec(data);
  if (!match || categoryLabel(match[2]) === null) return null;
  return { expenseId: match[1], key: match[2] };
}

export function buildCategoryKeyboard(expenseId: string): InlineKeyboard {
  const buttons = EXPENSE_CATEGORIES.map((category) => ({
    text: category.label,
    callback_data: encodeCategoryCallback(expenseId, category.key),
  }));
  const rows: InlineKeyboard["inline_keyboard"] = [];
  for (let index = 0; index < buttons.length; index += 4) rows.push(buttons.slice(index, index + 4));
  return { inline_keyboard: rows };
}

export type ImageRef = { fileId: string; fileSize: number | null; fileName: string | null };

/** The largest photo size, or an image sent as a file. */
export function pickImage(message: TgMessage): ImageRef | null {
  if (message.photo?.length) {
    const largest = [...message.photo].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return { fileId: largest.file_id, fileSize: largest.file_size ?? null, fileName: null };
  }
  if (message.document?.mime_type?.startsWith("image/")) {
    return {
      fileId: message.document.file_id,
      fileSize: message.document.file_size ?? null,
      fileName: message.document.file_name ?? null,
    };
  }
  return null;
}

export function formatBaht(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currencyLabel(currency: string): string {
  return currency === "THB" ? "บาท" : currency;
}

type Money = { amount: number; currency: string };

function totalsByCurrency(items: readonly Money[]): string[] {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  return [...totals].map(([currency, amount]) => `${formatBaht(amount)} ${currencyLabel(currency)}`);
}

export type DayItem = Money & { time: string | null; title: string | null; category: string };

export function formatDaySummary(date: string, items: readonly DayItem[]): string {
  if (items.length === 0) return `วันที่ ${formatDate(date)} ยังไม่มีรายการ`;
  const lines = items.map((item) =>
    [`• ${item.time ?? "--:--"}`, item.title ?? "ไม่ระบุ", item.category, `${formatBaht(item.amount)} ${currencyLabel(item.currency)}`].join(" · "),
  );
  return [`รายการวันที่ ${formatDate(date)}`, ...lines, "", `รวม ${totalsByCurrency(items).join(" + ")}`].join("\n");
}

export type MonthItem = Money & { category: string };

export function formatMonthSummary(month: string, expenses: readonly MonthItem[], payments: readonly Money[]): string {
  const title = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00.000Z`),
  );
  const lines = [`สรุปเดือน${title}`];
  if (expenses.length === 0) {
    lines.push("ยังไม่มีค่าใช้จ่ายที่บันทึก");
  } else {
    const byCategory = new Map<string, Money[]>();
    for (const item of expenses) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
    const sorted = [...byCategory].sort(
      (a, b) => b[1].reduce((sum, item) => sum + item.amount, 0) - a[1].reduce((sum, item) => sum + item.amount, 0),
    );
    for (const [category, items] of sorted) lines.push(`• ${category} ${totalsByCurrency(items).join(" + ")}`);
    lines.push("", `ค่าใช้จ่าย ${expenses.length} รายการ รวม ${totalsByCurrency(expenses).join(" + ")}`);
  }
  if (payments.length > 0) lines.push(`Subscription ที่จ่ายแล้ว ${totalsByCurrency(payments).join(" + ")}`);
  return lines.join("\n");
}

export const HELP_TEXT = [
  "บันทึกค่าใช้จ่ายได้เลย เช่น",
  "• ข้าว 60",
  "• 45 กาแฟ",
  "• ส่งรูปสลิปพร้อมคำบรรยาย เช่น 350 ค่าไฟ",
  "",
  "คำสั่ง",
  "/today ดูรายการวันนี้",
  "/month สรุปเดือนนี้",
  "/undo ยกเลิกรายการล่าสุด",
].join("\n");

export const FORMAT_HINT = "พิมพ์ชื่อรายการกับยอดเงิน เช่น ข้าว 60 หรือพิมพ์ /help";
