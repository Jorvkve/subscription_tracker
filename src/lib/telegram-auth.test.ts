import { describe, expect, it } from "vitest";
import { chatAccess, checkWebhookSecret, readTelegramConfig } from "@/lib/telegram-auth";

describe("readTelegramConfig", () => {
  it("trims values and treats blanks as missing", () => {
    expect(
      readTelegramConfig({ TELEGRAM_BOT_TOKEN: " 123:abc ", TELEGRAM_WEBHOOK_SECRET: "", TELEGRAM_ALLOWED_CHAT_ID: "42" }),
    ).toEqual({ token: "123:abc", webhookSecret: null, allowedChatId: "42" });
  });
});

describe("checkWebhookSecret", () => {
  it("accepts only the exact secret", () => {
    expect(checkWebhookSecret("s3cret-value", "s3cret-value")).toBe(true);
    expect(checkWebhookSecret("s3cret-valuX", "s3cret-value")).toBe(false);
    expect(checkWebhookSecret("short", "s3cret-value")).toBe(false);
    expect(checkWebhookSecret(null, "s3cret-value")).toBe(false);
    expect(checkWebhookSecret("anything", null)).toBe(false);
  });
});

describe("chatAccess", () => {
  it("serves only the owner's private chat", () => {
    expect(chatAccess(42, "private", "42")).toBe("allowed");
    expect(chatAccess(7, "private", "42")).toBe("ignored");
    expect(chatAccess(42, "group", "42")).toBe("ignored");
  });

  it("reports setup before an owner is configured, in private chats only", () => {
    expect(chatAccess(42, "private", null)).toBe("setup");
    expect(chatAccess(42, "supergroup", null)).toBe("ignored");
  });
});
