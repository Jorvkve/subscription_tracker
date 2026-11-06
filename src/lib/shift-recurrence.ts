import { addDays } from "@/lib/dates";

export const MAX_RECURRENCE_DAYS = 366;

/** Weekday labels indexed from 0 = Sunday, matching `calendarGrid`. */
export const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
export const WORKING_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];

export type ShiftDatePlan = { dates: string[]; error: null } | { dates: []; error: string };

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dayNumber(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime() / 86_400_000;
}

/** Dates from start through end inclusive that fall on a selected weekday. */
export function expandShiftDates(input: {
  startDate: string;
  endDate: string;
  weekdays: readonly number[];
}): string[] {
  const selected = new Set(input.weekdays);
  const dates: string[] = [];
  const dayCount = dayNumber(input.endDate) - dayNumber(input.startDate) + 1;
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDays(input.startDate, offset);
    if (selected.has(new Date(`${date}T00:00:00.000Z`).getUTCDay())) dates.push(date);
  }
  return dates;
}

/**
 * The recurrence rules, shared by the form preview and the server.
 * With no end date and no weekdays, this is one shift on the start date.
 */
export function planShiftDates(input: {
  startDate: string;
  endDate: string;
  weekdays: readonly number[];
}): ShiftDatePlan {
  const { startDate, endDate, weekdays } = input;
  const fail = (error: string): ShiftDatePlan => ({ dates: [], error });

  if (!startDate) return fail("กรุณาระบุวันที่เริ่ม");
  if (!isCalendarDate(startDate)) return fail("กรุณาระบุวันที่เริ่มที่ถูกต้องตามปฏิทินจริง");
  if (!endDate && weekdays.length === 0) return { dates: [startDate], error: null };
  if (!endDate) return fail("กรุณาระบุวันที่สิ้นสุดเพื่อทำซ้ำ");
  if (!isCalendarDate(endDate)) return fail("กรุณาระบุวันที่สิ้นสุดที่ถูกต้องตามปฏิทินจริง");
  if (weekdays.length === 0) return fail("กรุณาเลือกวันที่ต้องการทำซ้ำอย่างน้อย 1 วัน");
  if (endDate < startDate) return fail("วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม");
  if (dayNumber(endDate) - dayNumber(startDate) + 1 > MAX_RECURRENCE_DAYS) {
    return fail(`ช่วงวันที่ทำซ้ำต้องไม่เกิน ${MAX_RECURRENCE_DAYS} วัน`);
  }

  const dates = expandShiftDates({ startDate, endDate, weekdays });
  if (dates.length === 0) return fail("วันที่เลือกไม่ตรงกับช่วงวันที่นี้ จึงไม่มีกะให้สร้าง");
  return { dates, error: null };
}
