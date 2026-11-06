import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "@/lib/token-crypto";

const SECRET = "test-secret-at-least-32-characters-long";
const PLAIN = "ya29.this-is-a-fake-refresh-token";

describe("encryptToken / decryptToken", () => {
  it("roundtrips a token correctly", () => {
    const stored = encryptToken(PLAIN, SECRET);
    expect(decryptToken(stored, SECRET)).toBe(PLAIN);
  });

  it("produces different ciphertexts each call (random IV)", () => {
    const a = encryptToken(PLAIN, SECRET);
    const b = encryptToken(PLAIN, SECRET);
    expect(a).not.toBe(b);
  });

  it("throws when data is tampered", () => {
    const stored = encryptToken(PLAIN, SECRET);
    // flip a byte in the ciphertext portion
    const buf = Buffer.from(stored, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptToken(tampered, SECRET)).toThrow();
  });

  it("throws when the secret is wrong", () => {
    const stored = encryptToken(PLAIN, SECRET);
    expect(() => decryptToken(stored, "wrong-secret-wrong-secret-wrong")).toThrow();
  });

  it("throws for completely invalid base64 gibberish", () => {
    expect(() => decryptToken("!!!not-base64!!!", SECRET)).toThrow();
  });

  it("throws when stored value is too short to contain IV+tag+data", () => {
    const short = Buffer.from("tooshort").toString("base64");
    expect(() => decryptToken(short, SECRET)).toThrow();
  });
});
