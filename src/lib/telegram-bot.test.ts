import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/lib/telegram", () => ({
  FileTooLargeError: class FileTooLargeError extends Error {},
  answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  downloadFile: vi.fn(),
  editMessageText: vi.fn().mockResolvedValue(undefined),
  getFilePath: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/google-drive", () => ({
  DriveAuthError: class DriveAuthError extends Error {},
  DriveNotConnectedError: class DriveNotConnectedError extends Error {},
  trashSlip: vi.fn().mockResolvedValue(undefined),
  uploadSlip: vi.fn(),
}));

import { trashSlip, uploadSlip } from "@/lib/google-drive";
import { getPrisma } from "@/lib/prisma";
import { answerCallbackQuery, downloadFile, editMessageText, getFilePath, sendMessage } from "@/lib/telegram";
import { handleTelegramUpdate } from "@/lib/telegram-bot";

const OWNER = 42;
const config = { token: "t", webhookSecret: "s", allowedChatId: String(OWNER) };
const EXPENSE_ID = "cmh7k2x9b0000abcd1234efgh";

const db = {
  telegramUpdate: { create: vi.fn() },
  expenseSlip: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  payment: { findMany: vi.fn() },
};

function textUpdate(text: string, chatId = OWNER, updateId = 1) {
  return { update_id: updateId, message: { message_id: 10, chat: { id: chatId, type: "private" }, text } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue(db as never);
  db.telegramUpdate.create.mockResolvedValue({});
  db.expenseSlip.create.mockResolvedValue({ id: EXPENSE_ID });
});

describe("handleTelegramUpdate", () => {
  it("ignores other chats without replying or saving", async () => {
    await handleTelegramUpdate(textUpdate("ข้าว 60", 7), config);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(db.telegramUpdate.create).not.toHaveBeenCalled();
  });

  it("only reports the chat id before setup", async () => {
    await handleTelegramUpdate(textUpdate("/start"), { ...config, allowedChatId: null });
    expect(sendMessage).toHaveBeenCalledWith(OWNER, expect.stringContaining(`Chat ID ของคุณคือ ${OWNER}`));
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
  });

  it("skips an update it has already processed", async () => {
    db.telegramUpdate.create.mockRejectedValue({ code: "P2002" });
    await handleTelegramUpdate(textUpdate("ข้าว 60"), config);
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rethrows when the update cannot be recorded, so Telegram retries", async () => {
    db.telegramUpdate.create.mockRejectedValue(new Error("db down"));
    await expect(handleTelegramUpdate(textUpdate("ข้าว 60"), config)).rejects.toThrow("db down");
  });

  it("records a text expense and offers categories", async () => {
    await handleTelegramUpdate(textUpdate("ข้าว 60"), config);
    expect(db.expenseSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 60, note: "ข้าว", source: "TELEGRAM", category: "อื่นๆ" }),
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith(
      OWNER,
      "บันทึก 60.00 บาท · ข้าว",
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
  });

  it("answers unreadable text with a hint and saves nothing", async () => {
    await handleTelegramUpdate(textUpdate("สวัสดี"), config);
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(OWNER, expect.stringContaining("ข้าว 60"));
  });

  it("sets the category from a button and removes the keyboard", async () => {
    db.expenseSlip.findUnique.mockResolvedValue({ source: "TELEGRAM" });
    await handleTelegramUpdate(
      {
        update_id: 2,
        callback_query: {
          id: "cb",
          data: `cat:${EXPENSE_ID}:food`,
          message: { message_id: 11, chat: { id: OWNER, type: "private" }, text: "บันทึก 60.00 บาท · ข้าว" },
        },
      },
      config,
    );
    expect(db.expenseSlip.update).toHaveBeenCalledWith({ where: { id: EXPENSE_ID }, data: { category: "อาหาร" } });
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "บันทึกหมวดแล้ว");
    expect(editMessageText).toHaveBeenCalledWith(OWNER, 11, "บันทึก 60.00 บาท · ข้าว · อาหาร", { inline_keyboard: [] });
  });

  it("refuses a button for an expense that did not come from Telegram", async () => {
    db.expenseSlip.findUnique.mockResolvedValue({ source: "WEB" });
    await handleTelegramUpdate(
      { update_id: 3, callback_query: { id: "cb", data: `cat:${EXPENSE_ID}:food`, message: { message_id: 11, chat: { id: OWNER, type: "private" } } } },
      config,
    );
    expect(db.expenseSlip.update).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "ไม่พบรายการ");
  });

  it("undoes the latest Telegram expense and trashes its image", async () => {
    db.expenseSlip.findFirst.mockResolvedValue({ id: EXPENSE_ID, amount: 60, note: "ข้าว", driveFileId: "drive-1" });
    await handleTelegramUpdate(textUpdate("/undo"), config);
    expect(db.expenseSlip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ source: "TELEGRAM" }) }),
    );
    expect(db.expenseSlip.delete).toHaveBeenCalledWith({ where: { id: EXPENSE_ID } });
    expect(trashSlip).toHaveBeenCalledWith("drive-1");
    expect(sendMessage).toHaveBeenCalledWith(OWNER, "ยกเลิกแล้ว: 60.00 บาท · ข้าว");
  });

  it("asks for an amount when a photo has no caption, without downloading it", async () => {
    await handleTelegramUpdate(
      { update_id: 4, message: { message_id: 12, chat: { id: OWNER, type: "private" }, photo: [{ file_id: "p", width: 10, height: 10 }] } },
      config,
    );
    expect(getFilePath).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(OWNER, expect.stringContaining("ใส่ยอดเงิน"));
  });

  it("stores a captioned photo in Drive and links it to the expense", async () => {
    vi.mocked(getFilePath).mockResolvedValue("photos/file.jpg");
    vi.mocked(downloadFile).mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0x00]));
    vi.mocked(uploadSlip).mockResolvedValue("drive-2");
    await handleTelegramUpdate(
      {
        update_id: 5,
        message: { message_id: 13, chat: { id: OWNER, type: "private" }, caption: "350 ค่าไฟ", photo: [{ file_id: "p", width: 10, height: 10 }] },
      },
      config,
    );
    expect(uploadSlip).toHaveBeenCalledWith(expect.any(Uint8Array), expect.stringMatching(/\.jpg$/), "image/jpeg");
    expect(db.expenseSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 350, driveFileId: "drive-2", contentType: "image/jpeg" }) }),
    );
    expect(sendMessage).toHaveBeenCalledWith(OWNER, "บันทึก 350.00 บาท · ค่าไฟ · มีรูปสลิป", expect.anything());
  });

  it("trashes the uploaded image when saving the expense fails", async () => {
    vi.mocked(getFilePath).mockResolvedValue("photos/file.jpg");
    vi.mocked(downloadFile).mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0x00]));
    vi.mocked(uploadSlip).mockResolvedValue("drive-3");
    db.expenseSlip.create.mockRejectedValue(new Error("insert failed"));
    await handleTelegramUpdate(
      {
        update_id: 6,
        message: { message_id: 14, chat: { id: OWNER, type: "private" }, caption: "60", photo: [{ file_id: "p", width: 10, height: 10 }] },
      },
      config,
    );
    expect(trashSlip).toHaveBeenCalledWith("drive-3");
    expect(sendMessage).toHaveBeenCalledWith(OWNER, "บันทึกไม่สำเร็จ กรุณาลองใหม่");
  });
});
