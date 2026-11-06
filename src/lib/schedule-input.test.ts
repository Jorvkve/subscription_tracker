import { describe, expect, it } from "vitest";
import { TaskStatus } from "@/generated/prisma/client";
import {
  parseShiftForm,
  parseTaskForm,
  resolveCompletedAt,
} from "@/lib/schedule-input";

describe("resolveCompletedAt", () => {
  const fixedNow = new Date("2026-11-06T12:00:00.000Z");
  const pastDate = new Date("2026-10-15T08:30:00.000Z");

  it("returns now when transitioning to DONE from null (new task)", () => {
    const result = resolveCompletedAt(null, TaskStatus.DONE, fixedNow);
    expect(result).toEqual(fixedNow);
  });

  it("returns null when creating a task with non-DONE status", () => {
    expect(resolveCompletedAt(null, TaskStatus.TODO, fixedNow)).toBeNull();
    expect(resolveCompletedAt(null, TaskStatus.IN_PROGRESS, fixedNow)).toBeNull();
  });

  it("returns now on transition to DONE from TODO or IN_PROGRESS", () => {
    const todoPrev = { status: TaskStatus.TODO, completedAt: null };
    expect(resolveCompletedAt(todoPrev, TaskStatus.DONE, fixedNow)).toEqual(fixedNow);

    const inProgressPrev = { status: TaskStatus.IN_PROGRESS, completedAt: null };
    expect(resolveCompletedAt(inProgressPrev, TaskStatus.DONE, fixedNow)).toEqual(fixedNow);
  });

  it("keeps existing completedAt when already DONE and staying DONE", () => {
    const donePrev = { status: TaskStatus.DONE, completedAt: pastDate };
    const result = resolveCompletedAt(donePrev, TaskStatus.DONE, fixedNow);
    expect(result).toEqual(pastDate);
  });

  it("returns null when transitioning from DONE to TODO or IN_PROGRESS", () => {
    const donePrev = { status: TaskStatus.DONE, completedAt: pastDate };
    expect(resolveCompletedAt(donePrev, TaskStatus.TODO, fixedNow)).toBeNull();
    expect(resolveCompletedAt(donePrev, TaskStatus.IN_PROGRESS, fixedNow)).toBeNull();
  });

  it("returns null when remaining in TODO or IN_PROGRESS", () => {
    const todoPrev = { status: TaskStatus.TODO, completedAt: null };
    expect(resolveCompletedAt(todoPrev, TaskStatus.IN_PROGRESS, fixedNow)).toBeNull();
    expect(resolveCompletedAt(todoPrev, TaskStatus.TODO, fixedNow)).toBeNull();

    const inProgressPrev = { status: TaskStatus.IN_PROGRESS, completedAt: null };
    expect(resolveCompletedAt(inProgressPrev, TaskStatus.IN_PROGRESS, fixedNow)).toBeNull();
    expect(resolveCompletedAt(inProgressPrev, TaskStatus.TODO, fixedNow)).toBeNull();
  });
});

describe("parseTaskForm", () => {
  it("parses valid task input with all fields", () => {
    const formData = new FormData();
    formData.set("title", "ส่งรายงานภาษี");
    formData.set("description", "เตรียมเอกสาร ภ.พ.30");
    formData.set("dueDate", "2026-11-15");
    formData.set("priority", "HIGH");
    formData.set("status", "IN_PROGRESS");

    const result = parseTaskForm(formData);
    expect(result.title).toBe("ส่งรายงานภาษี");
    expect(result.description).toBe("เตรียมเอกสาร ภ.พ.30");
    expect(result.dueDateString).toBe("2026-11-15");
    expect(result.dueDate?.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(result.priority).toBe("HIGH");
    expect(result.status).toBe("IN_PROGRESS");
  });

  it("applies defaults for missing optional fields", () => {
    const formData = new FormData();
    formData.set("title", "อ่านหนังสือ");

    const result = parseTaskForm(formData);
    expect(result.title).toBe("อ่านหนังสือ");
    expect(result.description).toBeNull();
    expect(result.dueDate).toBeNull();
    expect(result.dueDateString).toBeNull();
    expect(result.priority).toBe("MEDIUM");
    expect(result.status).toBe("TODO");
  });

  it("rejects empty title or title longer than 200 characters", () => {
    const emptyForm = new FormData();
    emptyForm.set("title", "   ");
    expect(() => parseTaskForm(emptyForm)).toThrow(/1 ถึง 200/);

    const longForm = new FormData();
    longForm.set("title", "a".repeat(201));
    expect(() => parseTaskForm(longForm)).toThrow(/1 ถึง 200/);
  });

  it("rejects description longer than 2000 characters", () => {
    const formData = new FormData();
    formData.set("title", "งานทดสอบ");
    formData.set("description", "x".repeat(2001));
    expect(() => parseTaskForm(formData)).toThrow(/2000/);
  });

  it("rejects invalid calendar dates like 2026-02-30", () => {
    const nonDateForm = new FormData();
    nonDateForm.set("title", "งานทดสอบ");
    nonDateForm.set("dueDate", "2026-02-30");
    expect(() => parseTaskForm(nonDateForm)).toThrow(/ปฏิทินจริง/);

    const malformedForm = new FormData();
    malformedForm.set("title", "งานทดสอบ");
    malformedForm.set("dueDate", "invalid-date");
    expect(() => parseTaskForm(malformedForm)).toThrow(/YYYY-MM-DD/);
  });

  it("rejects invalid priority and status values", () => {
    const badPriority = new FormData();
    badPriority.set("title", "งานทดสอบ");
    badPriority.set("priority", "URGENT");
    expect(() => parseTaskForm(badPriority)).toThrow(/ระดับความสำคัญ/);

    const badStatus = new FormData();
    badStatus.set("title", "งานทดสอบ");
    badStatus.set("status", "ARCHIVED");
    expect(() => parseTaskForm(badStatus)).toThrow(/สถานะงาน/);
  });
});

describe("parseShiftForm", () => {
  it("parses valid shift with defaults", () => {
    const formData = new FormData();
    formData.set("title", "กะเช้า");
    formData.set("date", "2026-11-10");
    formData.set("startTime", "08:00");
    formData.set("endTime", "16:00");
    formData.set("location", "อาคาร A ชั้น 4");
    formData.set("notes", "เตรียมบัตรพนักงาน");

    const result = parseShiftForm(formData);
    expect(result.title).toBe("กะเช้า");
    expect(result.date).toBe("2026-11-10");
    expect(result.startTime).toBe("08:00");
    expect(result.endTime).toBe("16:00");
    expect(result.location).toBe("อาคาร A ชั้น 4");
    expect(result.notes).toBe("เตรียมบัตรพนักงาน");
    expect(result.repeatWeeks).toBe(1);
    expect(result.dates).toEqual(["2026-11-10"]);
  });

  it("generates repeating dates 7 days apart across month boundaries", () => {
    const formData = new FormData();
    formData.set("title", "กะวันอาทิตย์");
    formData.set("date", "2026-10-25");
    formData.set("startTime", "09:00");
    formData.set("endTime", "17:00");
    formData.set("repeatWeeks", "4");

    const result = parseShiftForm(formData);
    expect(result.repeatWeeks).toBe(4);
    expect(result.dates).toEqual([
      "2026-10-25",
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
    ]);
  });

  it("rejects equal start and end times", () => {
    const formData = new FormData();
    formData.set("title", "กะผิดพลาด");
    formData.set("date", "2026-11-10");
    formData.set("startTime", "10:00");
    formData.set("endTime", "10:00");
    expect(() => parseShiftForm(formData)).toThrow(/เวลาเริ่มและเวลาสิ้นสุดต้องไม่ตรงกัน/);
  });

  it("rejects invalid title length", () => {
    const emptyForm = new FormData();
    emptyForm.set("title", "");
    emptyForm.set("date", "2026-11-10");
    emptyForm.set("startTime", "08:00");
    emptyForm.set("endTime", "16:00");
    expect(() => parseShiftForm(emptyForm)).toThrow(/1 ถึง 100/);

    const longForm = new FormData();
    longForm.set("title", "a".repeat(101));
    longForm.set("date", "2026-11-10");
    longForm.set("startTime", "08:00");
    longForm.set("endTime", "16:00");
    expect(() => parseShiftForm(longForm)).toThrow(/1 ถึง 100/);
  });

  it("rejects invalid dates like 2026-02-30", () => {
    const formData = new FormData();
    formData.set("title", "กะทดสอบ");
    formData.set("date", "2026-02-30");
    formData.set("startTime", "08:00");
    formData.set("endTime", "16:00");
    expect(() => parseShiftForm(formData)).toThrow(/ปฏิทินจริง/);
  });

  it("rejects location > 200 or notes > 2000", () => {
    const locForm = new FormData();
    locForm.set("title", "กะทดสอบ");
    locForm.set("date", "2026-11-10");
    locForm.set("startTime", "08:00");
    locForm.set("endTime", "16:00");
    locForm.set("location", "L".repeat(201));
    expect(() => parseShiftForm(locForm)).toThrow(/200/);

    const notesForm = new FormData();
    notesForm.set("title", "กะทดสอบ");
    notesForm.set("date", "2026-11-10");
    notesForm.set("startTime", "08:00");
    notesForm.set("endTime", "16:00");
    notesForm.set("notes", "N".repeat(2001));
    expect(() => parseShiftForm(notesForm)).toThrow(/2000/);
  });

  it("rejects repeatWeeks out of 1-26 range or non-integer", () => {
    const testCases = ["0", "27", "-1", "3.5", "abc"];
    for (const val of testCases) {
      const formData = new FormData();
      formData.set("title", "กะทดสอบ");
      formData.set("date", "2026-11-10");
      formData.set("startTime", "08:00");
      formData.set("endTime", "16:00");
      formData.set("repeatWeeks", val);
      expect(() => parseShiftForm(formData)).toThrow(/1 ถึง 26/);
    }
  });
});
