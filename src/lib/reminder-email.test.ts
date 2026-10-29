import { describe, expect, it } from "vitest";
import { buildReminderEmail, readReminderMailConfig } from "@/lib/reminder-email";

const input = {
  name: "Cloud & <Family>",
  amount: 39,
  currency: "THB",
  dueDate: "2026-11-02",
  intervalCount: 1,
  intervalUnit: "MONTH" as const,
  paymentMethod: "Visa",
  daysBefore: 3,
};

describe("reminder email", () => {
  it("includes the service, amount, due date, interval, and reminder offset", () => {
    const message = buildReminderEmail(input);
    expect(message.subject).toContain("Cloud & <Family>");
    expect(message.text).toContain("39.00 THB");
    expect(message.text).toContain("2026-11-02");
    expect(message.text).toContain("1 เดือน");
    expect(message.text).toContain("3 วัน");
    expect(message.html).toContain("Cloud &amp; &lt;Family&gt;");
    expect(message.html).not.toContain("Cloud & <Family>");
  });

  it("requires SMTP credentials and defaults the recipient to the authorized account", () => {
    expect(readReminderMailConfig({ SMTP_USER: "owner@example.com" })).toBeNull();
    expect(readReminderMailConfig({
      SMTP_USER: "owner@example.com",
      SMTP_APP_PASSWORD: "abcd efgh ijkl mnop",
      ALLOWED_GOOGLE_EMAILS: "owner@example.com,other@example.com",
    })).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      user: "owner@example.com",
      password: "abcdefghijklmnop",
      to: "owner@example.com",
    });
  });

  it("allows a separate server-side reminder recipient", () => {
    expect(readReminderMailConfig({
      SMTP_USER: "sender@example.com",
      SMTP_APP_PASSWORD: "abcdefghijklmnop",
      REMINDER_EMAIL_TO: "owner@example.com",
      SMTP_HOST: "mail.example.com",
      SMTP_PORT: "587",
    })).toMatchObject({
      host: "mail.example.com",
      port: 587,
      user: "sender@example.com",
      to: "owner@example.com",
    });
  });
});
