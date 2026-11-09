import "server-only";
import { withRetry } from "@/lib/retry";

/**
 * Reads a payment slip or receipt with the Gemini API. Optional: without GEMINI_API_KEY
 * every reading is null and entry stays manual. The key never leaves the server.
 */

export type SlipReading = {
  amount: number;
  /** YYYY-MM-DD in the Christian calendar, or null when the slip shows no usable date. */
  date: string | null;
  /** HH:mm, or null. */
  time: string | null;
  payee: string | null;
};

// The lite alias answered a slip in about 2 s on 2026-11-09; full Flash took over 75 s under load.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
const TIMEOUT_MS = 20_000;
// Busy or rate-limited answers (429, 5xx) and timeouts are tried again after these waits.
const RETRY_DELAYS_MS = [2000, 5000];
const MAX_AMOUNT = 1_000_000_000;

const PROMPT = [
  "This image should be a Thai bank transfer slip, a PromptPay slip, or a shop receipt.",
  "Return the money paid, as JSON.",
  "amount: the total paid in Thai baht, a number without commas; null if no amount is readable.",
  "date: the payment date as YYYY-MM-DD in the Christian calendar. Thai slips often use Buddhist years",
  "(2569 or a short 69 means 2026); convert them. null if there is no date.",
  "time: the payment time as HH:mm in 24-hour form, or null.",
  "payee: the receiver or shop name as printed, or null. Not the payer.",
  "isSlip: false if the image is not a slip or receipt.",
].join("\n");

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    isSlip: { type: "boolean" },
    amount: { type: "number", nullable: true },
    date: { type: "string", nullable: true },
    time: { type: "string", nullable: true },
    payee: { type: "string", nullable: true },
  },
  required: ["isSlip", "amount", "date", "time", "payee"],
};

export function isSlipOcrConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GEMINI_API_KEY?.trim());
}

function validDate(text: string, today: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  let year = Number(match[1]);
  if (year > 2400) year -= 543; // a Buddhist year the model did not convert
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  const iso = value.toISOString().slice(0, 10);
  return iso > today || iso < "2000-01-01" ? null : iso;
}

function validTime(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(text.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? `${String(hour).padStart(2, "0")}:${match[2]}` : null;
}

/** Checks the model's JSON; anything it cannot trust becomes null. Pure, so it is unit tested. */
export function toSlipReading(value: unknown, today: string): SlipReading | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.isSlip === false) return null;
  const amount = typeof raw.amount === "number" ? Math.round(raw.amount * 100) / 100 : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  const payee = typeof raw.payee === "string" ? raw.payee.trim().slice(0, 200) : "";
  return {
    amount,
    date: typeof raw.date === "string" ? validDate(raw.date, today) : null,
    time: typeof raw.time === "string" ? validTime(raw.time) : null,
    payee: payee || null,
  };
}

class BusyError extends Error {
  constructor(readonly status: number) {
    super(`Gemini busy: HTTP ${status}`);
    this.name = "BusyError";
  }
}

type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

/** Returns null when OCR is off, the call fails, or the image has no readable amount. */
export async function readSlip(bytes: Uint8Array, contentType: string, today: string): Promise<SlipReading | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: contentType, data: Buffer.from(bytes).toString("base64") } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  });

  try {
    const response = await withRetry(
      async () => {
        const answer = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
          },
        );
        if (answer.status === 429 || answer.status >= 500) throw new BusyError(answer.status);
        return answer;
      },
      {
        delaysMs: RETRY_DELAYS_MS,
        shouldRetry: (error) => error instanceof BusyError || (error instanceof Error && error.name === "TimeoutError"),
      },
    );
    if (!response.ok) {
      // Status only: the body can echo the request.
      console.error("[slip-ocr] Gemini returned", response.status);
      return null;
    }
    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    return toSlipReading(JSON.parse(text), today);
  } catch (error) {
    console.error("[slip-ocr] read failed:", error instanceof BusyError ? `HTTP ${error.status}` : error instanceof Error ? error.name : "unknown");
    return null;
  }
}
