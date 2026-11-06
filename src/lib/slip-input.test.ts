import { describe, expect, it } from "vitest";
import {
  detectImageType,
  MAX_SLIP_BYTES,
  parseSlipForm,
  validateSlipFile,
} from "@/lib/slip-input";

// Magic bytes helpers
function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // size (don't care)
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x00,
  ]);
}

function unknownBytes(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
}

describe("detectImageType", () => {
  it("detects JPEG from magic bytes", () => {
    expect(detectImageType(jpegBytes())).toBe("image/jpeg");
  });

  it("detects PNG from magic bytes", () => {
    expect(detectImageType(pngBytes())).toBe("image/png");
  });

  it("detects WebP from magic bytes", () => {
    expect(detectImageType(webpBytes())).toBe("image/webp");
  });

  it("returns null for unknown types", () => {
    expect(detectImageType(unknownBytes())).toBeNull();
  });

  it("returns null for empty bytes", () => {
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });

  it("returns null for too-short buffers", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateSlipFile", () => {
  function makeFile(size: number, name = "slip.jpg"): File {
    const buf = new Uint8Array(size).fill(0xff);
    return new File([buf], name, { type: "image/jpeg" });
  }

  it("throws for null/undefined file", () => {
    expect(() => validateSlipFile(null)).toThrow("กรุณาเลือกไฟล์");
    expect(() => validateSlipFile(undefined)).toThrow("กรุณาเลือกไฟล์");
  });

  it("throws for empty file", () => {
    expect(() => validateSlipFile(makeFile(0))).toThrow("กรุณาเลือกไฟล์");
  });

  it("throws for files over 4 MiB", () => {
    expect(() => validateSlipFile(makeFile(MAX_SLIP_BYTES + 1))).toThrow("4 MB");
  });

  it("accepts a file at exactly 4 MiB", () => {
    expect(() => validateSlipFile(makeFile(MAX_SLIP_BYTES))).not.toThrow();
  });

  it("accepts a small valid file", () => {
    expect(() => validateSlipFile(makeFile(1024))).not.toThrow();
  });
});

describe("parseSlipForm", () => {
  function baseForm(overrides: Record<string, string> = {}): FormData {
    const f = new FormData();
    f.set("amount", "150.50");
    f.set("currency", "THB");
    f.set("paidDate", "2026-11-07");
    for (const [k, v] of Object.entries(overrides)) f.set(k, v);
    return f;
  }

  it("parses valid minimal input", () => {
    const result = parseSlipForm(baseForm());
    expect(result.amount).toBe(150.5);
    expect(result.currency).toBe("THB");
    expect(result.paidDate).toBe("2026-11-07");
    expect(result.paidTime).toBeNull();
    expect(result.payee).toBeNull();
    expect(result.category).toBe("Other");
    expect(result.note).toBeNull();
    expect(result.subscriptionId).toBeNull();
  });

  it("parses all optional fields", () => {
    const result = parseSlipForm(
      baseForm({
        paidTime: "13:45",
        payee: "ร้านกาแฟ",
        category: "Food",
        note: "ซื้อกาแฟ",
        subscriptionId: "clxyz123",
      }),
    );
    expect(result.paidTime).toBe("13:45");
    expect(result.payee).toBe("ร้านกาแฟ");
    expect(result.category).toBe("Food");
    expect(result.note).toBe("ซื้อกาแฟ");
    expect(result.subscriptionId).toBe("clxyz123");
  });

  it("uppercases currency", () => {
    const result = parseSlipForm(baseForm({ currency: "usd" }));
    expect(result.currency).toBe("USD");
  });

  it("empty category becomes Other", () => {
    const result = parseSlipForm(baseForm({ category: "" }));
    expect(result.category).toBe("Other");
  });

  it("rejects amount <= 0", () => {
    expect(() => parseSlipForm(baseForm({ amount: "0" }))).toThrow("จำนวนเงิน");
    expect(() => parseSlipForm(baseForm({ amount: "-1" }))).toThrow("จำนวนเงิน");
  });

  it("rejects amount > 1,000,000,000", () => {
    expect(() => parseSlipForm(baseForm({ amount: "1000000001" }))).toThrow("จำนวนเงิน");
  });

  it("rejects amount with more than 2 decimal places", () => {
    expect(() => parseSlipForm(baseForm({ amount: "10.123" }))).toThrow("ทศนิยม");
  });

  it("accepts amount with exactly 2 decimal places", () => {
    expect(() => parseSlipForm(baseForm({ amount: "10.12" }))).not.toThrow();
  });

  it("rejects number formats that Number() would accept", () => {
    for (const amount of ["0x10", "1e5", "1e-3", "Infinity", " .5", "5."]) {
      expect(() => parseSlipForm(baseForm({ amount }))).toThrow("จำนวนเงิน");
    }
  });

  it("rejects non-numeric amount", () => {
    expect(() => parseSlipForm(baseForm({ amount: "abc" }))).toThrow("จำนวนเงิน");
  });

  it("rejects invalid currency (not 3 letters)", () => {
    expect(() => parseSlipForm(baseForm({ currency: "TH" }))).toThrow("สกุลเงิน");
    expect(() => parseSlipForm(baseForm({ currency: "THBB" }))).toThrow("สกุลเงิน");
    expect(() => parseSlipForm(baseForm({ currency: "123" }))).toThrow("สกุลเงิน");
  });

  it("rejects invalid paidDate", () => {
    expect(() => parseSlipForm(baseForm({ paidDate: "not-a-date" }))).toThrow("YYYY-MM-DD");
    expect(() => parseSlipForm(baseForm({ paidDate: "2026-02-30" }))).toThrow("ปฏิทินจริง");
  });

  it("rejects invalid paidTime", () => {
    expect(() => parseSlipForm(baseForm({ paidTime: "25:00" }))).toThrow();
    expect(() => parseSlipForm(baseForm({ paidTime: "9:30" }))).toThrow();
  });

  it("rejects payee > 200 chars", () => {
    expect(() => parseSlipForm(baseForm({ payee: "a".repeat(201) }))).toThrow("200");
  });

  it("rejects category > 100 chars", () => {
    expect(() => parseSlipForm(baseForm({ category: "a".repeat(101) }))).toThrow("100");
  });

  it("rejects note > 2000 chars", () => {
    expect(() => parseSlipForm(baseForm({ note: "a".repeat(2001) }))).toThrow("2000");
  });
});
