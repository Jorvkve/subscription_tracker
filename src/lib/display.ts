import type { BillingUnit } from "@/generated/prisma/client";

export function money(value: number, currency: string) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function cycleName(count: number, unit: BillingUnit) {
  const names: Record<BillingUnit, string> = {
    DAY: "วัน",
    WEEK: "สัปดาห์",
    MONTH: "เดือน",
    YEAR: "ปี",
  };
  return `ทุก ${count} ${names[unit]}`;
}

export function dayDifference(from: string, to: string) {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}
