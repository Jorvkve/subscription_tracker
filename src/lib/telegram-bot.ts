import "server-only";
import { revalidatePath } from "next/cache";
import { addDays, appDateString, appTimeString, utcDate } from "@/lib/dates";
import { categoryLabel } from "@/lib/expense-categories";
import { DriveAuthError, DriveNotConnectedError, trashSlip, uploadSlip } from "@/lib/google-drive";
import { getPrisma } from "@/lib/prisma";
import { detectImageType, slipDriveFileName } from "@/lib/slip-input";
import { recordSubscriptionPayment } from "@/lib/subscription-payment";
import {
  FileTooLargeError,
  answerCallbackQuery,
  downloadFile,
  editMessageText,
  getFilePath,
  sendMessage,
} from "@/lib/telegram";
import { chatAccess, type TelegramConfig } from "@/lib/telegram-auth";
import {
  FORMAT_HINT,
  HELP_TEXT,
  buildCategoryKeyboard,
  buildDeleteConfirm,
  buildDeletePicker,
  decodeCategoryCallback,
  decodeDeleteCallback,
  describeExpense,
  formatBaht,
  formatDaySummary,
  formatMonthSummary,
  parseCommand,
  parseExpenseText,
  pickImage,
  type BotCommand,
  type ImageRef,
  type InlineKeyboard,
  type ParsedExpense,
  type TgCallbackQuery,
  type TgMessage,
  type TgUpdate,
} from "@/lib/telegram-parse";
import { decodePaidCallback, paidConfirmation } from "@/lib/telegram-reminder";

const MAX_TELEGRAM_IMAGE_BYTES = 10 * 1024 * 1024;
const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UNDO_LIST_SIZE = 8;
const DEFAULT_CATEGORY = categoryLabel("other") ?? "อื่นๆ";

function isUpdate(value: unknown): value is TgUpdate {
  return typeof value === "object" && value !== null && Number.isSafeInteger((value as TgUpdate).update_id);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function refreshPages() {
  revalidatePath("/");
  revalidatePath("/slips");
}

async function trySend(chatId: number, text: string) {
  await sendMessage(chatId, text).catch(() => undefined);
}

/**
 * Handles one webhook update. Returns normally once the update is processed or ignored;
 * throws only when it could not be recorded, so Telegram retries it.
 */
export async function handleTelegramUpdate(update: unknown, config: TelegramConfig): Promise<void> {
  if (!isUpdate(update)) return;
  const message = update.message;
  const callback = update.callback_query;
  const chat = message?.chat ?? callback?.message?.chat;
  if (!chat) return;

  const access = chatAccess(chat.id, chat.type, config.allowedChatId);
  if (access === "ignored") return;
  if (access === "setup") {
    if (message) {
      await trySend(chat.id, `Chat ID ของคุณคือ ${chat.id} ใส่ค่านี้ใน TELEGRAM_ALLOWED_CHAT_ID แล้ว deploy ใหม่`);
    }
    return;
  }

  try {
    await getPrisma().telegramUpdate.create({ data: { updateId: BigInt(update.update_id) } });
  } catch (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }

  try {
    if (callback) await handleCallback(callback, chat.id);
    else if (message) await handleMessage(message);
  } catch (error) {
    console.error("[telegram] update failed:", error instanceof Error ? error.name : "unknown");
    if (callback) await answerCallbackQuery(callback.id, "เกิดข้อผิดพลาด").catch(() => undefined);
    else await trySend(chat.id, "บันทึกไม่สำเร็จ กรุณาลองใหม่");
  }
}

async function handleMessage(message: TgMessage) {
  const chatId = message.chat.id;
  const image = pickImage(message);
  if (image) return handleImage(message, image, message.caption ?? "");

  const text = (message.text ?? "").trim();
  const command = parseCommand(text);
  if (command) return handleCommand(command, chatId);

  // Replying to an earlier photo with the amount attaches that photo.
  const repliedImage = message.reply_to_message ? pickImage(message.reply_to_message) : null;
  if (repliedImage) return handleImage(message, repliedImage, text);

  const parsed = parseExpenseText(text);
  if (!parsed) return sendMessage(chatId, FORMAT_HINT);
  const expense = await createExpense(parsed, null);
  await sendSaved(chatId, expense.id, parsed, false);
}

type StoredImage = { driveFileId: string; fileName: string; contentType: string; sizeBytes: number };

async function createExpense(parsed: ParsedExpense, image: StoredImage | null) {
  const expense = await getPrisma().expenseSlip.create({
    data: {
      amount: parsed.amount,
      currency: "THB",
      paidDate: utcDate(appDateString()),
      paidTime: appTimeString(),
      note: parsed.note,
      category: DEFAULT_CATEGORY,
      source: "TELEGRAM",
      ...image,
    },
    select: { id: true },
  });
  refreshPages();
  return expense;
}

async function sendSaved(chatId: number, expenseId: string, parsed: ParsedExpense, withImage: boolean) {
  const parts = [`บันทึก ${formatBaht(parsed.amount)} บาท`];
  if (parsed.note) parts.push(parsed.note);
  if (withImage) parts.push("มีรูปสลิป");
  await sendMessage(chatId, parts.join(" · "), buildCategoryKeyboard(expenseId));
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-ก-๙ ]/g, "_").slice(0, 200);
}

async function handleImage(message: TgMessage, image: ImageRef, text: string) {
  const chatId = message.chat.id;
  const parsed = parseExpenseText(text);
  if (!parsed) {
    return sendMessage(chatId, "ใส่ยอดเงินในคำบรรยายรูป หรือตอบกลับ (reply) รูปนี้ด้วยยอดเงิน เช่น 60 ข้าว");
  }
  if (image.fileSize !== null && image.fileSize > MAX_TELEGRAM_IMAGE_BYTES) {
    return sendMessage(chatId, "รูปใหญ่เกิน 10 MB");
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadFile(await getFilePath(image.fileId), MAX_TELEGRAM_IMAGE_BYTES);
  } catch (error) {
    if (error instanceof FileTooLargeError) return sendMessage(chatId, "รูปใหญ่เกิน 10 MB");
    throw error;
  }
  const contentType = detectImageType(bytes);
  if (!contentType) return sendMessage(chatId, "รองรับเฉพาะรูป JPEG, PNG หรือ WebP");

  const driveName = slipDriveFileName(appDateString(), appTimeString(), contentType);
  let driveFileId: string;
  try {
    driveFileId = await uploadSlip(bytes, driveName, contentType);
  } catch (error) {
    if (error instanceof DriveNotConnectedError || error instanceof DriveAuthError) {
      return sendMessage(chatId, `${error.message} ที่หน้าสลิปค่าใช้จ่ายบนเว็บ`);
    }
    throw error;
  }

  let expense: { id: string };
  try {
    expense = await createExpense(parsed, {
      driveFileId,
      fileName: image.fileName ? sanitizeFileName(image.fileName) : driveName,
      contentType,
      sizeBytes: bytes.length,
    });
  } catch (error) {
    await trashSlip(driveFileId).catch(() => undefined);
    throw error;
  }
  await sendSaved(chatId, expense.id, parsed, true);
}

async function handleCallback(callback: TgCallbackQuery, chatId: number) {
  const paid = decodePaidCallback(callback.data ?? "");
  if (paid) return handlePaidCallback(callback, chatId, paid);

  const deletion = decodeDeleteCallback(callback.data ?? "");
  if (deletion) return handleDeleteCallback(callback, chatId, deletion);

  const decoded = decodeCategoryCallback(callback.data ?? "");
  const label = decoded ? categoryLabel(decoded.key) : null;
  const db = getPrisma();
  const expense = decoded
    ? await db.expenseSlip.findUnique({ where: { id: decoded.expenseId }, select: { source: true } })
    : null;
  if (!decoded || !label || !expense || expense.source !== "TELEGRAM") {
    return answerCallbackQuery(callback.id, "ไม่พบรายการ");
  }

  await db.expenseSlip.update({ where: { id: decoded.expenseId }, data: { category: label } });
  refreshPages();
  await answerCallbackQuery(callback.id, "บันทึกหมวดแล้ว");
  if (callback.message?.text) {
    await editMessageText(chatId, callback.message.message_id, `${callback.message.text} · ${label}`, {
      inline_keyboard: [],
    }).catch(() => undefined);
  }
}

const PAID_NOTES = {
  already_paid: "รอบนี้บันทึกการจ่ายไปแล้ว",
  inactive: "รายการนี้ไม่ได้ใช้งานอยู่ จึงไม่ได้บันทึก",
  not_found: "ไม่พบรายการ Subscription นี้",
} as const;

/** The reminder's "จ่ายแล้ว" button pays only the cycle the reminder was sent for. */
async function handlePaidCallback(
  callback: TgCallbackQuery,
  chatId: number,
  paid: NonNullable<ReturnType<typeof decodePaidCallback>>,
) {
  const result = await recordSubscriptionPayment(paid.subscriptionId, paid.dueDate);
  const note = result.ok ? paidConfirmation(result) : PAID_NOTES[result.reason];
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${paid.subscriptionId}`);
  }
  await answerCallbackQuery(callback.id, result.ok ? "บันทึกแล้ว" : note);
  const message = callback.message;
  if (message) {
    const text = message.text ? `${message.text}\n\n${note}` : note;
    await editMessageText(chatId, message.message_id, text, { inline_keyboard: [] }).catch(() => undefined);
  }
}

async function handleCommand(command: BotCommand, chatId: number) {
  if (command === "start" || command === "help") return sendMessage(chatId, HELP_TEXT);
  if (command === "today") return sendToday(chatId);
  if (command === "month") return sendMonth(chatId);
  return sendDeletePicker(chatId);
}

async function sendToday(chatId: number) {
  const today = appDateString();
  const rows = await getPrisma().expenseSlip.findMany({
    where: { paidDate: utcDate(today) },
    orderBy: [{ paidTime: "asc" }, { createdAt: "asc" }],
    select: { amount: true, currency: true, paidTime: true, payee: true, note: true, category: true },
  });
  await sendMessage(
    chatId,
    formatDaySummary(
      today,
      rows.map((row) => ({
        amount: Number(row.amount),
        currency: row.currency,
        time: row.paidTime,
        title: row.payee || row.note,
        category: row.category,
      })),
    ),
  );
}

async function sendMonth(chatId: number) {
  const month = appDateString().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;
  const db = getPrisma();
  const [expenses, payments] = await Promise.all([
    db.expenseSlip.findMany({
      where: { paidDate: { gte: utcDate(first), lte: utcDate(last) } },
      select: { amount: true, currency: true, category: true },
    }),
    // A day of margin on each side, then filter by the app timezone's calendar month.
    db.payment.findMany({
      where: { paidAt: { gte: utcDate(addDays(first, -1)), lt: utcDate(addDays(last, 2)) } },
      select: { amount: true, currency: true, paidAt: true },
    }),
  ]);
  await sendMessage(
    chatId,
    formatMonthSummary(
      month,
      expenses.map((row) => ({ amount: Number(row.amount), currency: row.currency, category: row.category })),
      payments
        .filter((row) => appDateString(row.paidAt).startsWith(month))
        .map((row) => ({ amount: Number(row.amount), currency: row.currency })),
    ),
  );
}

const DELETABLE_SELECT = {
  id: true,
  amount: true,
  paidDate: true,
  paidTime: true,
  payee: true,
  note: true,
  driveFileId: true,
  source: true,
} as const;

type DeletableRow = {
  id: string;
  amount: unknown;
  paidDate: Date;
  paidTime: string | null;
  payee: string | null;
  note: string | null;
  driveFileId: string | null;
};

function toDeletable(row: DeletableRow) {
  return {
    id: row.id,
    paidDate: row.paidDate.toISOString().slice(0, 10),
    paidTime: row.paidTime,
    title: row.payee || row.note,
    amount: Number(row.amount),
    hasImage: Boolean(row.driveFileId),
  };
}

/** Lists recent bot entries as buttons; deleting takes a second confirming tap. */
async function sendDeletePicker(chatId: number) {
  const rows = await getPrisma().expenseSlip.findMany({
    where: { source: "TELEGRAM", createdAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: UNDO_LIST_SIZE,
    select: DELETABLE_SELECT,
  });
  if (rows.length === 0) return sendMessage(chatId, "ไม่มีรายการจากบอทใน 7 วันที่ผ่านมา");
  await sendMessage(chatId, "เลือกรายการที่จะลบ", buildDeletePicker(rows.map(toDeletable), appDateString()));
}

async function handleDeleteCallback(
  callback: TgCallbackQuery,
  chatId: number,
  deletion: NonNullable<ReturnType<typeof decodeDeleteCallback>>,
) {
  const messageId = callback.message?.message_id;
  const edit = (text: string, keyboard: InlineKeyboard = { inline_keyboard: [] }) =>
    messageId === undefined ? Promise.resolve() : editMessageText(chatId, messageId, text, keyboard).catch(() => undefined);

  if (deletion.action === "cancel") {
    await answerCallbackQuery(callback.id);
    return edit("ไม่ได้ลบรายการใด");
  }

  const db = getPrisma();
  const row = await db.expenseSlip.findUnique({ where: { id: deletion.expenseId }, select: DELETABLE_SELECT });
  if (!row || row.source !== "TELEGRAM") {
    await answerCallbackQuery(callback.id, "รายการนี้ถูกลบไปแล้ว");
    return edit("รายการนี้ถูกลบไปแล้ว");
  }
  const summary = describeExpense(toDeletable(row), appDateString(), 60);

  if (deletion.action === "pick") {
    await answerCallbackQuery(callback.id);
    return edit(`ลบรายการนี้?\n${summary}`, buildDeleteConfirm(row.id));
  }

  await db.expenseSlip.delete({ where: { id: row.id } });
  refreshPages();
  if (row.driveFileId) await trashSlip(row.driveFileId).catch(() => undefined);
  await answerCallbackQuery(callback.id, "ลบแล้ว");
  await edit(`ลบแล้ว: ${summary}${row.driveFileId ? "\nรูปย้ายไปถังขยะใน Drive แล้ว" : ""}`);
}
