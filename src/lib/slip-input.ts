import { parseTimeOfDay } from "@/lib/time-of-day";

export const MAX_SLIP_BYTES = 4 * 1024 * 1024; // 4 MiB

/**
 * Detect image MIME type from magic bytes.
 * Never trust the browser's file.type or the file name.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Validate a slip file (File or null/undefined).
 * Throws an Error with a Thai message on failure.
 */
export function validateSlipFile(file: File | null | undefined): void {
  if (!file || file.size === 0) {
    throw new Error("กรุณาเลือกไฟล์รูปภาพสลิป");
  }
  if (file.size > MAX_SLIP_BYTES) {
    throw new Error("ขนาดไฟล์ต้องไม่เกิน 4 MB");
  }
}

export type SlipFormInput = {
  amount: number;
  currency: string;
  paidDate: string;
  paidTime: string | null;
  payee: string | null;
  category: string;
  note: string | null;
  subscriptionId: string | null;
};

// TODO(slip-ocr): pre-fill these fields by reading the slip image. Deferred by the user; entry is manual for now.
export function parseSlipForm(formData: FormData): SlipFormInput {
  const amountRaw = String(formData.get("amount") ?? "").trim();
  // Number() alone would accept forms such as 0x10 and 1e-3.
  if (/^\d+\.\d{3,}$/.test(amountRaw)) {
    throw new Error("จำนวนเงินต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง");
  }
  const amount = /^\d+(\.\d{1,2})?$/.test(amountRaw) ? Number(amountRaw) : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new Error("กรุณาระบุจำนวนเงินที่ถูกต้อง (มากกว่า 0 ไม่เกิน 1,000,000,000)");
  }

  const currencyRaw = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyRaw)) {
    throw new Error("สกุลเงินต้องเป็นรหัส 3 ตัวอักษร");
  }

  const paidDateRaw = String(formData.get("paidDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDateRaw)) {
    throw new Error("กรุณาระบุวันที่ชำระในรูปแบบ YYYY-MM-DD");
  }
  const parsedDate = new Date(`${paidDateRaw}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== paidDateRaw
  ) {
    throw new Error("กรุณาระบุวันที่ชำระที่ถูกต้องตามปฏิทินจริง");
  }

  const paidTimeRaw = String(formData.get("paidTime") ?? "").trim();
  let paidTime: string | null = null;
  if (paidTimeRaw) {
    paidTime = parseTimeOfDay(paidTimeRaw);
  }

  const payeeRaw = String(formData.get("payee") ?? "").trim();
  if (payeeRaw.length > 200) {
    throw new Error("ชื่อผู้รับเงินต้องไม่เกิน 200 ตัวอักษร");
  }
  const payee = payeeRaw || null;

  const categoryRaw = String(formData.get("category") ?? "").trim();
  if (categoryRaw.length > 100) {
    throw new Error("หมวดหมู่ต้องไม่เกิน 100 ตัวอักษร");
  }
  const category = categoryRaw || "Other";

  const noteRaw = String(formData.get("note") ?? "").trim();
  if (noteRaw.length > 2000) {
    throw new Error("บันทึกต้องไม่เกิน 2000 ตัวอักษร");
  }
  const note = noteRaw || null;

  const subscriptionIdRaw = String(formData.get("subscriptionId") ?? "").trim();
  const subscriptionId = subscriptionIdRaw || null;

  return {
    amount,
    currency: currencyRaw,
    paidDate: paidDateRaw,
    paidTime,
    payee,
    category,
    note,
    subscriptionId,
  };
}
