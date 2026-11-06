import { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { addDays } from "@/lib/dates";
import { parseTimeOfDay } from "@/lib/time-of-day";

export type TaskFormInput = {
  title: string;
  description: string | null;
  dueDate: Date | null;
  dueDateString: string | null;
  priority: TaskPriority;
  status: TaskStatus;
};

export type ShiftFormInput = {
  title: string;
  date: string;
  dates: string[];
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  repeatWeeks: number;
};

export type TaskCompletionState = {
  status: TaskStatus | string;
  completedAt: Date | null;
};

export function resolveCompletedAt(
  previous: TaskCompletionState | null | undefined,
  nextStatus: TaskStatus,
  now: Date = new Date(),
): Date | null {
  if (nextStatus === TaskStatus.DONE) {
    if (previous?.status === TaskStatus.DONE) {
      return previous.completedAt;
    }
    return now;
  }
  return null;
}

export function parseTaskForm(formData: FormData): TaskFormInput {
  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > 200) {
    throw new Error("กรุณาระบุชื่องานความยาว 1 ถึง 200 ตัวอักษร");
  }

  const descriptionRaw = formData.get("description");
  const description = descriptionRaw !== null ? String(descriptionRaw).trim() || null : null;
  if (description && description.length > 2000) {
    throw new Error("รายละเอียดต้องไม่เกิน 2000 ตัวอักษร");
  }

  const dueDateRaw = formData.get("dueDate");
  const dueDateValue = dueDateRaw !== null ? String(dueDateRaw).trim() : "";
  let dueDate: Date | null = null;
  let dueDateString: string | null = null;

  if (dueDateValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)) {
      throw new Error("กรุณาระบุวันครบกำหนดในรูปแบบ YYYY-MM-DD");
    }
    const parsedDate = new Date(`${dueDateValue}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dueDateValue
    ) {
      throw new Error("กรุณาระบุวันครบกำหนดที่ถูกต้องตามปฏิทินจริง");
    }
    dueDate = parsedDate;
    dueDateString = dueDateValue;
  }

  const priorityRaw = formData.get("priority");
  const priorityStr = priorityRaw !== null && String(priorityRaw).trim() !== ""
    ? String(priorityRaw).trim()
    : "MEDIUM";
  const allowedPriorities = Object.values(TaskPriority) as string[];
  if (!allowedPriorities.includes(priorityStr)) {
    throw new Error("ระดับความสำคัญไม่ถูกต้อง");
  }
  const priority = priorityStr as TaskPriority;

  const statusRaw = formData.get("status");
  const statusStr = statusRaw !== null && String(statusRaw).trim() !== ""
    ? String(statusRaw).trim()
    : "TODO";
  const allowedStatuses = Object.values(TaskStatus) as string[];
  if (!allowedStatuses.includes(statusStr)) {
    throw new Error("สถานะงานไม่ถูกต้อง");
  }
  const status = statusStr as TaskStatus;

  return {
    title,
    description,
    dueDate,
    dueDateString,
    priority,
    status,
  };
}

export function parseShiftForm(formData: FormData): ShiftFormInput {
  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > 100) {
    throw new Error("กรุณาระบุชื่องานกะความยาว 1 ถึง 100 ตัวอักษร");
  }

  const dateValue = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD");
  }
  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== dateValue
  ) {
    throw new Error("กรุณาระบุวันที่ที่ถูกต้องตามปฏิทินจริง");
  }

  const startRaw = formData.get("startTime");
  const endRaw = formData.get("endTime");
  const startTime = parseTimeOfDay(startRaw);
  const endTime = parseTimeOfDay(endRaw);

  if (startTime === endTime) {
    throw new Error("เวลาเริ่มและเวลาสิ้นสุดต้องไม่ตรงกัน");
  }

  const locationRaw = formData.get("location");
  const location = locationRaw !== null ? String(locationRaw).trim() || null : null;
  if (location && location.length > 200) {
    throw new Error("สถานที่ต้องไม่เกิน 200 ตัวอักษร");
  }

  const notesRaw = formData.get("notes");
  const notes = notesRaw !== null ? String(notesRaw).trim() || null : null;
  if (notes && notes.length > 2000) {
    throw new Error("บันทึกต้องไม่เกิน 2000 ตัวอักษร");
  }

  const repeatRaw = formData.get("repeatWeeks");
  let repeatWeeks = 1;
  if (repeatRaw !== null && repeatRaw !== undefined && String(repeatRaw).trim() !== "") {
    const parsed = Number(repeatRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 26) {
      throw new Error("จำนวนสัปดาห์ที่ทำซ้ำต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 26");
    }
    repeatWeeks = parsed;
  }

  const dates: string[] = [];
  for (let i = 0; i < repeatWeeks; i++) {
    dates.push(addDays(dateValue, i * 7));
  }

  return {
    title,
    date: dateValue,
    dates,
    startTime,
    endTime,
    location,
    notes,
    repeatWeeks,
  };
}
