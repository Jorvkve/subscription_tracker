import "server-only";
import type { InlineKeyboard } from "@/lib/telegram-parse";

const API_ORIGIN = "https://api.telegram.org";

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

// Request URLs contain the bot token, so errors carry only the method and status.
async function callApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/bot${botToken()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error(`Telegram ${method} failed: network`);
  }
  if (!response.ok) throw new Error(`Telegram ${method} failed: HTTP ${response.status}`);
  const data = (await response.json()) as { ok?: boolean; result?: T };
  if (!data.ok) throw new Error(`Telegram ${method} failed`);
  return data.result as T;
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: InlineKeyboard): Promise<void> {
  await callApi("sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callApi("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  await callApi("editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup });
}

export async function getFilePath(fileId: string): Promise<string> {
  const file = await callApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram getFile failed: no path");
  return file.file_path;
}

export async function downloadFile(filePath: string, maxBytes: number): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/file/bot${botToken()}/${filePath}`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Telegram file download failed: network");
  }
  if (!response.ok) throw new Error(`Telegram file download failed: HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new FileTooLargeError();
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new FileTooLargeError();
  return bytes;
}

export class FileTooLargeError extends Error {
  constructor() {
    super("File too large");
    this.name = "FileTooLargeError";
  }
}
