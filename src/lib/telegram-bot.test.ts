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
// Real retries, without the waits.
vi.mock("@/lib/retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retry")>();
  return {
    ...actual,
    withRetry: <T,>(task: () => Promise<T>, options: Parameters<typeof actual.withRetry>[1] = {}) =>
      actual.withRetry(task, { ...options, delaysMs: (options.delaysMs ?? [1, 1]).map(() => 0) }),
  };
});
vi.mock("@/lib/slip-ocr", () => ({ isSlipOcrConfigured: vi.fn().mockReturnValue(false), readSlip: vi.fn() }));
vi.mock("@/lib/subscription-payment", () => ({ recordSubscriptionPayment: vi.fn() }));
vi.mock("@/lib/budget-data", () => ({ budgetAlertAfter: vi.fn().mockResolvedValue(null), monthBudgetLines: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/google-drive", () => ({
  DriveAuthError: class DriveAuthError extends Error {},
  DriveNotConnectedError: class DriveNotConnectedError extends Error {},
  trashSlip: vi.fn().mockResolvedValue(undefined),
  uploadSlip: vi.fn(),
}));

import { DriveNotConnectedError, trashSlip, uploadSlip } from "@/lib/google-drive";
import { getPrisma } from "@/lib/prisma";
import { isSlipOcrConfigured, readSlip } from "@/lib/slip-ocr";
import { recordSubscriptionPayment } from "@/lib/subscription-payment";
import { budgetAlertAfter } from "@/lib/budget-data";
import { answerCallbackQuery, downloadFile, editMessageText, getFilePath, sendMessage } from "@/lib/telegram";
import { handleTelegramUpdate } from "@/lib/telegram-bot";
import type { InlineKeyboard } from "@/lib/telegram-parse";

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
  vi.mocked(isSlipOcrConfigured).mockReturnValue(false);
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

  it("records a backdated entry without a time", async () => {
    await handleTelegramUpdate(textUpdate("1/1/2569 อาหาร 50"), config);
    expect(db.expenseSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 50,
          note: "อาหาร",
          paidDate: new Date("2026-01-01T00:00:00.000Z"),
          paidTime: null,
        }),
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith(
      OWNER,
      expect.stringMatching(/^บันทึก 50\.00 บาท · อาหาร · วันที่ /),
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
  });

  it("explains a date it cannot use and saves nothing", async () => {
    await handleTelegramUpdate(textUpdate("31/2/2569 ข้าว 60"), config);
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(OWNER, "ไม่มีวันที่ 31/2/2569 ในปฏิทิน");
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
    expect(db.expenseSlip.update).toHaveBeenCalledWith({ where: { id: EXPENSE_ID }, data: { category: "ค่ากิน" } });
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "บันทึกหมวดแล้ว");
    expect(editMessageText).toHaveBeenCalledWith(OWNER, 11, "บันทึก 60.00 บาท · ข้าว · ค่ากิน", { inline_keyboard: [] });
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

  const storedRow = {
    id: EXPENSE_ID,
    amount: 60,
    paidDate: new Date("2026-11-07T00:00:00.000Z"),
    paidTime: "12:30",
    payee: null,
    note: "ข้าว",
    driveFileId: "drive-1",
    source: "TELEGRAM",
  };

  function deleteTap(data: string, updateId: number) {
    return {
      update_id: updateId,
      callback_query: { id: "cb", data, message: { message_id: 20, chat: { id: OWNER, type: "private" }, text: "เลือกรายการที่จะลบ" } },
    };
  }

  it("lists recent bot entries to pick from instead of deleting", async () => {
    db.expenseSlip.findMany.mockResolvedValue([storedRow]);
    await handleTelegramUpdate(textUpdate("/undo"), config);
    expect(db.expenseSlip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ source: "TELEGRAM" }), take: 8 }),
    );
    expect(db.expenseSlip.delete).not.toHaveBeenCalled();
    const keyboard = (vi.mocked(sendMessage).mock.calls[0][2] as InlineKeyboard).inline_keyboard;
    expect(keyboard[0][0].callback_data).toBe(`del:${EXPENSE_ID}`);
    expect(keyboard.at(-1)![0]).toEqual({ text: "ปิด", callback_data: "delno" });
  });

  it("says so when there is nothing to delete", async () => {
    db.expenseSlip.findMany.mockResolvedValue([]);
    await handleTelegramUpdate(textUpdate("/undo"), config);
    expect(sendMessage).toHaveBeenCalledWith(OWNER, "ไม่มีรายการจากบอทใน 7 วันที่ผ่านมา");
  });

  it("asks for confirmation after a pick, without deleting yet", async () => {
    db.expenseSlip.findUnique.mockResolvedValue(storedRow);
    await handleTelegramUpdate(deleteTap(`del:${EXPENSE_ID}`, 7), config);
    expect(db.expenseSlip.delete).not.toHaveBeenCalled();
    expect(editMessageText).toHaveBeenCalledWith(
      OWNER,
      20,
      expect.stringContaining("ลบรายการนี้?"),
      expect.objectContaining({
        inline_keyboard: [[expect.objectContaining({ callback_data: `delok:${EXPENSE_ID}` }), expect.objectContaining({ callback_data: "delno" })]],
      }),
    );
  });

  it("deletes the confirmed entry and trashes its image", async () => {
    db.expenseSlip.findUnique.mockResolvedValue(storedRow);
    await handleTelegramUpdate(deleteTap(`delok:${EXPENSE_ID}`, 8), config);
    expect(db.expenseSlip.delete).toHaveBeenCalledWith({ where: { id: EXPENSE_ID } });
    expect(trashSlip).toHaveBeenCalledWith("drive-1");
    expect(editMessageText).toHaveBeenCalledWith(OWNER, 20, expect.stringContaining("ลบแล้ว"), { inline_keyboard: [] });
  });

  it("does not delete an entry made on the web", async () => {
    db.expenseSlip.findUnique.mockResolvedValue({ ...storedRow, source: "WEB" });
    await handleTelegramUpdate(deleteTap(`delok:${EXPENSE_ID}`, 9), config);
    expect(db.expenseSlip.delete).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "รายการนี้ถูกลบไปแล้ว");
  });

  it("closes the picker on cancel", async () => {
    await handleTelegramUpdate(deleteTap("delno", 10), config);
    expect(db.expenseSlip.delete).not.toHaveBeenCalled();
    expect(editMessageText).toHaveBeenCalledWith(OWNER, 20, "ไม่ได้ลบรายการใด", { inline_keyboard: [] });
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

  function bareSlip(updateId: number, caption?: string) {
    vi.mocked(isSlipOcrConfigured).mockReturnValue(true);
    vi.mocked(getFilePath).mockResolvedValue("photos/file.jpg");
    vi.mocked(downloadFile).mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0x00]));
    vi.mocked(uploadSlip).mockResolvedValue("drive-4");
    return {
      update_id: updateId,
      message: { message_id: 15, chat: { id: OWNER, type: "private" }, caption, photo: [{ file_id: "p", width: 10, height: 10 }] },
    };
  }

  it("reads a photo without an amount and saves what the slip says", async () => {
    vi.mocked(readSlip).mockResolvedValue({ amount: 245.5, date: "2026-01-02", time: "14:05", payee: "ร้านข้าวแกง" });
    await handleTelegramUpdate(bareSlip(7, "มื้อเที่ยง"), config);
    expect(db.expenseSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 245.5,
          paidDate: new Date("2026-01-02T00:00:00.000Z"),
          paidTime: "14:05",
          payee: "ร้านข้าวแกง",
          note: "มื้อเที่ยง",
          driveFileId: "drive-4",
        }),
      }),
    );
    expect(uploadSlip).toHaveBeenCalledWith(expect.any(Uint8Array), "02-01-2026_14-05.jpg", "image/jpeg");
    expect(sendMessage).toHaveBeenCalledWith(
      OWNER,
      expect.stringMatching(/^อ่านจากสลิป .*\/undo\nบันทึก 245\.50 บาท · ร้านข้าวแกง · มื้อเที่ยง · วันที่ .* · 14:05 น\. · มีรูปสลิป$/),
      expect.anything(),
    );
  });

  it("does not read the slip when the caption has an amount", async () => {
    await handleTelegramUpdate(bareSlip(8, "60 ข้าว"), config);
    expect(readSlip).not.toHaveBeenCalled();
    expect(db.expenseSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 60, note: "ข้าว" }) }),
    );
  });

  it("asks for the amount when the slip cannot be read, without uploading", async () => {
    vi.mocked(readSlip).mockResolvedValue(null);
    await handleTelegramUpdate(bareSlip(9), config);
    expect(uploadSlip).not.toHaveBeenCalled();
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      OWNER,
      expect.stringContaining("อ่านยอดเงินจากสลิปไม่ได้"),
      { inline_keyboard: [[{ text: "ลองใหม่", callback_data: "img:retry" }]] },
      15,
    );
  });

  it("retries a Drive upload that fails once, so the owner sees nothing", async () => {
    vi.mocked(readSlip).mockResolvedValue({ amount: 80, date: null, time: null, payee: null });
    const update = bareSlip(10);
    vi.mocked(uploadSlip).mockRejectedValueOnce(new Error("Failed to upload slip to Drive: HTTP 429"));
    await handleTelegramUpdate(update, config);
    expect(uploadSlip).toHaveBeenCalledTimes(2);
    expect(db.expenseSlip.create).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(OWNER, expect.stringContaining("บันทึก 80.00 บาท"), expect.anything());
  });

  it("does not retry when Drive is not connected", async () => {
    vi.mocked(readSlip).mockResolvedValue({ amount: 80, date: null, time: null, payee: null });
    const update = bareSlip(11);
    vi.mocked(uploadSlip).mockRejectedValue(new DriveNotConnectedError());
    await handleTelegramUpdate(update, config);
    expect(uploadSlip).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(OWNER, expect.stringContaining("ที่หน้าสลิปค่าใช้จ่ายบนเว็บ"));
  });

  it("runs the photo again from the retry button, without a new upload from the owner", async () => {
    vi.mocked(readSlip).mockResolvedValue({ amount: 99, date: null, time: null, payee: null });
    const photo = bareSlip(12).message;
    await handleTelegramUpdate(
      {
        update_id: 13,
        callback_query: {
          id: "cb-retry",
          data: "img:retry",
          message: { message_id: 30, chat: { id: OWNER, type: "private" }, text: "บันทึกรูปนี้ไม่สำเร็จ", reply_to_message: photo },
        },
      },
      config,
    );
    expect(editMessageText).toHaveBeenNthCalledWith(1, OWNER, 30, "กำลังลองใหม่…", { inline_keyboard: [] });
    expect(db.expenseSlip.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 99, driveFileId: "drive-4" }) }),
    );
    expect(editMessageText).toHaveBeenLastCalledWith(OWNER, 30, "ลองใหม่แล้ว ดูผลด้านล่าง", { inline_keyboard: [] });
  });

  it("offers the button again when a retry fails", async () => {
    vi.mocked(readSlip).mockResolvedValue({ amount: 99, date: null, time: null, payee: null });
    const photo = bareSlip(14).message;
    db.expenseSlip.create.mockRejectedValue(new Error("db down"));
    await handleTelegramUpdate(
      {
        update_id: 15,
        callback_query: {
          id: "cb-retry",
          data: "img:retry",
          message: { message_id: 31, chat: { id: OWNER, type: "private" }, text: "x", reply_to_message: photo },
        },
      },
      config,
    );
    expect(editMessageText).toHaveBeenLastCalledWith(OWNER, 31, "ลองใหม่ยังไม่สำเร็จ", { inline_keyboard: [] });
    expect(sendMessage).toHaveBeenCalledWith(OWNER, expect.stringContaining("ไม่ต้องส่งรูปซ้ำ"), expect.anything(), 15);
  });

  it("says so when the retry button has lost its photo", async () => {
    await handleTelegramUpdate(
      {
        update_id: 16,
        callback_query: { id: "cb-lost", data: "img:retry", message: { message_id: 32, chat: { id: OWNER, type: "private" }, text: "x" } },
      },
      config,
    );
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb-lost", "ไม่พบรูปเดิม กรุณาส่งรูปใหม่");
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
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
    // Saving was tried three times before giving up.
    expect(db.expenseSlip.create).toHaveBeenCalledTimes(3);
    expect(trashSlip).toHaveBeenCalledWith("drive-3");
    expect(sendMessage).toHaveBeenCalledWith(
      OWNER,
      'บันทึกรูปนี้ไม่สำเร็จ กด "ลองใหม่" ได้เลยโดยไม่ต้องส่งรูปซ้ำ',
      { inline_keyboard: [[{ text: "ลองใหม่", callback_data: "img:retry" }]] },
      14,
    );
  });
});

describe("subscription reminder paid button", () => {
  const SUB_ID = "cmh7k2x9b0000abcd1234efgh";
  function paidTap(updateId = 50) {
    return {
      update_id: updateId,
      callback_query: {
        id: "cb",
        data: `paid:${SUB_ID}:20261115`,
        message: { message_id: 30, chat: { id: OWNER, type: "private" }, text: "เตือนชำระ Netflix อีก 3 วัน" },
      },
    };
  }

  it("records the payment for the reminder's cycle and removes the button", async () => {
    vi.mocked(recordSubscriptionPayment).mockResolvedValue({
      ok: true,
      name: "Netflix",
      amount: 419,
      currency: "THB",
      coveredDueDate: "2026-11-15",
      nextDueDate: "2026-12-15",
    });
    await handleTelegramUpdate(paidTap(), config);
    expect(recordSubscriptionPayment).toHaveBeenCalledWith(SUB_ID, "2026-11-15");
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "บันทึกแล้ว");
    expect(editMessageText).toHaveBeenCalledWith(
      OWNER,
      30,
      expect.stringMatching(/^เตือนชำระ Netflix อีก 3 วัน\n\nบันทึกการจ่าย Netflix 419.00 บาท แล้ว/),
      { inline_keyboard: [] },
    );
  });

  it("tells the owner when the cycle was already paid", async () => {
    vi.mocked(recordSubscriptionPayment).mockResolvedValue({ ok: false, reason: "already_paid" });
    await handleTelegramUpdate(paidTap(51), config);
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "รอบนี้บันทึกการจ่ายไปแล้ว");
    expect(editMessageText).toHaveBeenCalledWith(OWNER, 30, expect.stringContaining("รอบนี้บันทึกการจ่ายไปแล้ว"), {
      inline_keyboard: [],
    });
  });

  it("ignores taps from other chats", async () => {
    const tap = paidTap(52);
    tap.callback_query.message.chat.id = 7;
    await handleTelegramUpdate(tap, config);
    expect(recordSubscriptionPayment).not.toHaveBeenCalled();
  });
});

describe("/edit amount", () => {
  const ID = "cmh7k2x9b0000abcd1234efgh";
  const row = {
    id: ID,
    amount: 45,
    paidDate: new Date("2026-11-08T00:00:00.000Z"),
    paidTime: null,
    payee: null,
    note: "กาแฟ",
    driveFileId: null,
    source: "TELEGRAM",
  };
  const prompt = `แก้ยอดรายการนี้\n8 พ.ย. · กาแฟ · 45.00 บาท\n\nตอบกลับ (reply) ข้อความนี้ด้วยยอดใหม่ เช่น 55\nรหัสรายการ ${ID}`;
  function reply(text: string, updateId: number) {
    return {
      update_id: updateId,
      message: {
        message_id: 41,
        chat: { id: OWNER, type: "private" },
        text,
        reply_to_message: { message_id: 40, chat: { id: OWNER, type: "private" }, text: prompt },
      },
    };
  }

  it("lists recent bot entries to pick from", async () => {
    db.expenseSlip.findMany.mockResolvedValue([row]);
    await handleTelegramUpdate(textUpdate("/edit", OWNER, 60), config);
    const [, text, keyboard] = vi.mocked(sendMessage).mock.calls[0];
    expect(text).toBe("เลือกรายการที่จะแก้ยอด");
    expect((keyboard as InlineKeyboard).inline_keyboard[0][0].callback_data).toBe(`edit:${ID}`);
  });

  it("asks for the new amount as a forced reply after a pick", async () => {
    db.expenseSlip.findUnique.mockResolvedValue(row);
    await handleTelegramUpdate(
      { update_id: 61, callback_query: { id: "cb", data: `edit:${ID}`, message: { message_id: 50, chat: { id: OWNER, type: "private" }, text: "เลือกรายการที่จะแก้ยอด" } } },
      config,
    );
    const [, text, markup] = vi.mocked(sendMessage).mock.calls[0];
    expect(text).toContain(`รหัสรายการ ${ID}`);
    expect(markup).toMatchObject({ force_reply: true });
  });

  it("updates the amount from a reply to the prompt", async () => {
    db.expenseSlip.findUnique.mockResolvedValue(row);
    db.expenseSlip.update.mockResolvedValue({});
    await handleTelegramUpdate(reply("55", 62), config);
    expect(db.expenseSlip.update).toHaveBeenCalledWith({ where: { id: ID }, data: { amount: 55 } });
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
    expect(vi.mocked(sendMessage).mock.calls[0][1]).toMatch(/^แก้ยอดแล้ว 45.00 → 55.00 บาท/);
  });

  it("refuses a reply that is not just an amount", async () => {
    await handleTelegramUpdate(reply("กาแฟ 55", 63), config);
    expect(db.expenseSlip.update).not.toHaveBeenCalled();
    expect(db.expenseSlip.create).not.toHaveBeenCalled();
    expect(vi.mocked(sendMessage).mock.calls[0][1]).toContain("พิมพ์เฉพาะยอดเงิน");
  });

  it("does not edit entries from the web", async () => {
    db.expenseSlip.findUnique.mockResolvedValue({ ...row, source: "WEB" });
    await handleTelegramUpdate(reply("55", 64), config);
    expect(db.expenseSlip.update).not.toHaveBeenCalled();
  });
});

describe("budget warnings", () => {
  const ID = "cmh7k2x9b0000abcd1234efgh";
  function categoryTap(key: string, updateId: number) {
    return {
      update_id: updateId,
      callback_query: { id: "cb", data: `cat:${ID}:${key}`, message: { message_id: 11, chat: { id: OWNER, type: "private" }, text: "บันทึก 600.00 บาท" } },
    };
  }
  const stored = { source: "TELEGRAM", category: "อื่นๆ", amount: 600, currency: "THB", paidDate: new Date("2026-11-09T00:00:00.000Z") };

  it("checks the budget of the category an entry was moved into and sends the warning", async () => {
    db.expenseSlip.findUnique.mockResolvedValue(stored);
    vi.mocked(budgetAlertAfter).mockResolvedValueOnce("⚠️ เกินงบอาหารแล้ว");
    await handleTelegramUpdate(categoryTap("food", 70), config);
    expect(budgetAlertAfter).toHaveBeenCalledWith("ค่ากิน", "2026-11-09", 600, "THB");
    expect(sendMessage).toHaveBeenCalledWith(OWNER, "⚠️ เกินงบอาหารแล้ว");
  });

  it("stays quiet when no threshold was crossed or the category did not change", async () => {
    db.expenseSlip.findUnique.mockResolvedValue({ ...stored, category: "ค่ากิน" });
    await handleTelegramUpdate(categoryTap("food", 71), config);
    expect(budgetAlertAfter).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("still sets the category when the budget check fails", async () => {
    db.expenseSlip.findUnique.mockResolvedValue(stored);
    vi.mocked(budgetAlertAfter).mockRejectedValueOnce(new Error("db down"));
    await handleTelegramUpdate(categoryTap("food", 72), config);
    expect(answerCallbackQuery).toHaveBeenCalledWith("cb", "บันทึกหมวดแล้ว");
    expect(sendMessage).not.toHaveBeenCalledWith(OWNER, "บันทึกไม่สำเร็จ กรุณาลองใหม่");
  });
});
