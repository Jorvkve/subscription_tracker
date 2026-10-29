import { Message, SMTPClient } from "emailjs";
import type { BillingUnit } from "@/lib/billing";

export type ReminderEmailInput = {
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
  intervalCount: number;
  intervalUnit: BillingUnit;
  paymentMethod: string | null;
  daysBefore: number;
};

export type ReminderMailConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  to: string;
};

export type ReminderMailContent = { subject: string; text: string; html: string };

const unitLabels: Record<BillingUnit, string> = {
  DAY: "วัน",
  WEEK: "สัปดาห์",
  MONTH: "เดือน",
  YEAR: "ปี",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function readReminderMailConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ReminderMailConfig | null {
  const user = env.SMTP_USER?.trim() ?? "";
  const password = env.SMTP_APP_PASSWORD?.replace(/\s/g, "") ?? "";
  const port = Number(env.SMTP_PORT || 465);
  const allowlistedRecipient = env.ALLOWED_GOOGLE_EMAILS?.split(",")[0]?.trim() ?? "";
  const to = env.REMINDER_EMAIL_TO?.trim() || allowlistedRecipient || user;
  if (!validEmail(user) || !password || !Number.isInteger(port) || port < 1 || port > 65535 || !validEmail(to)) {
    return null;
  }
  return {
    host: env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    user,
    password,
    to,
  };
}

export function buildReminderEmail(input: ReminderEmailInput): ReminderMailContent {
  const safeName = input.name.replace(/[\r\n]+/g, " ").slice(0, 100);
  const safePaymentMethod = input.paymentMethod?.replace(/[\r\n]+/g, " ").slice(0, 100) || "ไม่ได้ระบุ";
  const cycle = `ทุก ${input.intervalCount} ${unitLabels[input.intervalUnit]}`;
  const amount = `${input.amount.toFixed(2)} ${input.currency}`;
  const formattedDate = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${input.dueDate}T00:00:00.000Z`));
  const subject = `เตือนชำระ ${safeName} ล่วงหน้า ${input.daysBefore} วัน`;
  const text = [
    `บริการ: ${safeName}`,
    `ยอดที่ต้องชำระ: ${amount}`,
    `วันครบกำหนด: ${input.dueDate} (${formattedDate})`,
    `รอบบิล: ${cycle}`,
    `วิธีชำระ: ${safePaymentMethod}`,
    `แจ้งเตือนล่วงหน้า: ${input.daysBefore} วัน`,
    "เปิด Subscription Tracker เพื่อดูรายละเอียดหรือบันทึกการชำระ",
  ].join("\n");
  const html = `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17211d"><p>เตือนชำระ Subscription</p><h1 style="font-size:22px">${escapeHtml(safeName)}</h1><p>ครบกำหนดใน ${input.daysBefore} วัน</p><dl><dt>ยอดที่ต้องชำระ</dt><dd><strong>${escapeHtml(amount)}</strong></dd><dt>วันครบกำหนด</dt><dd>${escapeHtml(formattedDate)} <small>(${escapeHtml(input.dueDate)})</small></dd><dt>รอบบิล</dt><dd>${escapeHtml(cycle)}</dd><dt>วิธีชำระ</dt><dd>${escapeHtml(safePaymentMethod)}</dd></dl><p>เปิด Subscription Tracker เพื่อดูรายละเอียดหรือบันทึกการชำระ</p></main>`;
  return { subject, text, html };
}

export function createReminderTransport(config: ReminderMailConfig): SMTPClient {
  return new SMTPClient({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    ssl: config.port === 465,
    tls: config.port === 587,
    timeout: 15_000,
  });
}

export async function sendReminderEmail(
  input: ReminderEmailInput,
  config: ReminderMailConfig,
  transport: SMTPClient = createReminderTransport(config),
): Promise<string | null> {
  const content = buildReminderEmail(input);
  try {
    const result = await transport.sendAsync({
      from: `Subscription Tracker <${config.user}>`,
      to: config.to,
      ...content,
    });
    const headers = result instanceof Message ? result.header : result;
    const messageId = headers["message-id"];
    return typeof messageId === "string" ? messageId : null;
  } finally {
    transport.smtp.close();
  }
}
