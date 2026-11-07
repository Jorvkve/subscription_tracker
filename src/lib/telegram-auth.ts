import { timingSafeEqual } from "node:crypto";

export type TelegramConfig = {
  token: string | null;
  webhookSecret: string | null;
  allowedChatId: string | null;
};

export function readTelegramConfig(env: Readonly<Record<string, string | undefined>>): TelegramConfig {
  const read = (name: string) => env[name]?.trim() || null;
  return {
    token: read("TELEGRAM_BOT_TOKEN"),
    webhookSecret: read("TELEGRAM_WEBHOOK_SECRET"),
    allowedChatId: read("TELEGRAM_ALLOWED_CHAT_ID"),
  };
}

export function checkWebhookSecret(headerValue: string | null | undefined, secret: string | null): boolean {
  if (!headerValue || !secret) return false;
  const given = Buffer.from(headerValue, "utf8");
  const expected = Buffer.from(secret, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type ChatAccess = "allowed" | "setup" | "ignored";

/** Only the owner's private chat is served; before setup, the bot only reports the chat id. */
export function chatAccess(chatId: number, chatType: string, allowedChatId: string | null): ChatAccess {
  if (chatType !== "private") return "ignored";
  if (!allowedChatId) return "setup";
  return String(chatId) === allowedChatId ? "allowed" : "ignored";
}
