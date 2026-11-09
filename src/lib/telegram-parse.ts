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

export type DatedExpense = ParsedExpense & { date: string };
export type EntryResult = { ok: true; expense: DatedExpense } | { ok: false; error: string };

// A leading date: 8/11, 8/11/69, 8/11/2569 or 8-11-2026. Dots are left out so 12.5 stays an amount.
const LEADING_DATE = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?(?=\s|$)\s*([\s\S]*)$/;
const YESTERDAY = /^เมื่อวาน(?:นี้)?(?=\s|$|\d)\s*([\s\S]*)$/;

function isoDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return value.toISOString().slice(0, 10);
}

/** A 4-digit year above 2400 is Buddhist Era. A 2-digit year takes whichever reading is nearer to now. */
function toYear(text: string, currentYear: number): number {
  const value = Number(text);
  if (text.length === 4) return value > 2400 ? value - 543 : value;
  const christian = 2000 + value;
  const buddhist = 2500 + value - 543;
  return Math.abs(christian - currentYear) <= Math.abs(buddhist - currentYear) ? christian : buddhist;
}

function shiftYear(date: string, years: number): string | null {
  const [year, month, day] = date.split("-").map(Number);
  return isoDate(year + years, month, day);
}

/**
 * Reads an entry with an optional date in front: `8/11/2569 อาหาร 50`, `8/11 ข้าว 60`,
 * `เมื่อวาน ข้าว 60`. Without a date the entry is for `today`. Returns null when the text
 * is not an entry at all, and an error when the date cannot be used.
 */
export function parseEntry(input: string, today: string): EntryResult | null {
  const text = normalizeThaiDigits(input).trim();
  let date = today;
  let rest = text;

  const yesterday = YESTERDAY.exec(text);
  const dated = yesterday ? null : LEADING_DATE.exec(text);
  if (yesterday) {
    const [year, month, day] = today.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    rest = yesterday[1];
  } else if (dated) {
    const currentYear = Number(today.slice(0, 4));
    const day = Number(dated[1]);
    const month = Number(dated[2]);
    const explicitYear = dated[3] !== undefined;
    let parsed = isoDate(explicitYear ? toYear(dated[3], currentYear) : currentYear, month, day);
    // Without a year, a date later than today means last year (30/12 typed on 2 January).
    if (parsed && !explicitYear && parsed > today) parsed = shiftYear(parsed, -1);
    if (!parsed) return { ok: false, error: `ไม่มีวันที่ ${dated[1]}/${dated[2]}${explicitYear ? `/${dated[3]}` : ""} ในปฏิทิน` };
    if (parsed > today) return { ok: false, error: "วันที่อยู่ในอนาคต บันทึกได้เฉพาะวันนี้หรือย้อนหลัง" };
    if (parsed < "2000-01-01") return { ok: false, error: "วันที่เก่าเกินไป" };
    date = parsed;
    rest = dated[4];
  }

  const parsed = parseExpenseText(rest);
  if (!parsed) {
    return rest === text ? null : { ok: false, error: "ใส่ยอดเงินหลังวันที่ด้วย เช่น 8/11/2569 ข้าว 60" };
  }
  return { ok: true, expense: { ...parsed, date } };
}

export type BotCommand ="start" | "help" | "today" | "month" | "undo";

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

export type DeleteCallback =
  | { action: "pick"; expenseId: string }
  | { action: "confirm"; expenseId: string }
  | { action: "cancel" };

const DELETE_PATTERN = /^(del|delok):([a-z0-9]{20,32})$/;

export function encodeDeleteCallback(callback: DeleteCallback): string {
  if (callback.action === "cancel") return "delno";
  return `${callback.action === "pick" ? "del" : "delok"}:${callback.expenseId}`;
}

export function decodeDeleteCallback(data: string): DeleteCallback | null {
  if (data === "delno") return { action: "cancel" };
  const match = DELETE_PATTERN.exec(data);
  if (!match) return null;
  return { action: match[1] === "del" ? "pick" : "confirm", expenseId: match[2] };
}

export type DeletableExpense = {
  id: string;
  paidDate: string;
  paidTime: string | null;
  title: string | null;
  amount: number;
  hasImage: boolean;
};

/** One line that names an expense: date only when it is not today. */
export function describeExpense(expense: DeletableExpense, today: string, maxTitle = 24): string {
  const when = [
    expense.paidDate === today
      ? null
      : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(
          new Date(`${expense.paidDate}T00:00:00.000Z`),
        ),
    expense.paidTime,
  ]
    .filter(Boolean)
    .join(" ");
  const title = expense.title ? expense.title.slice(0, maxTitle) + (expense.title.length > maxTitle ? "…" : "") : "ไม่ระบุ";
  return [when || null, title, `${formatBaht(expense.amount)} บาท`, expense.hasImage ? "มีรูป" : null]
    .filter(Boolean)
    .join(" · ");
}

export function buildDeletePicker(expenses: readonly DeletableExpense[], today: string): InlineKeyboard {
  return {
    inline_keyboard: [
      ...expenses.map((expense) => [
        { text: describeExpense(expense, today), callback_data: encodeDeleteCallback({ action: "pick", expenseId: expense.id }) },
      ]),
      [{ text: "ปิด", callback_data: encodeDeleteCallback({ action: "cancel" }) }],
    ],
  };
}

export function buildDeleteConfirm(expenseId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "ยืนยันลบ", callback_data: encodeDeleteCallback({ action: "confirm", expenseId }) },
        { text: "ยกเลิก", callback_data: encodeDeleteCallback({ action: "cancel" }) },
      ],
    ],
  };
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
  "บันทึกย้อนหลัง ใส่วันที่ไว้ข้างหน้า เช่น",
  "• 8/11/2569 อาหาร 50",
  "• 8/11 ข้าว 60 (ปีนี้)",
  "• เมื่อวาน กาแฟ 45",
  "",
  "คำสั่ง",
  "/today ดูรายการวันนี้",
  "/month สรุปเดือนนี้",
  "/undo เลือกรายการที่จะลบ",
].join("\n");

export const FORMAT_HINT = "พิมพ์ชื่อรายการกับยอดเงิน เช่น ข้าว 60 หรือพิมพ์ /help";
