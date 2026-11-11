"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TaskStatus } from "@/generated/prisma/client";
import { utcDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import {
  parseShiftCreateForm,
  parseShiftForm,
  parseTaskForm,
  resolveCompletedAt,
  type ShiftCreateInput,
  type ShiftFormInput,
  type TaskFormInput,
} from "@/lib/schedule-input";
import { requireSession } from "@/lib/session";
import { parseShiftScope, seriesWhere } from "@/lib/shift-series";
import type { FormActionState } from "@/app/actions";

export async function createTask(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireSession();
  let data: TaskFormInput;
  try {
    data = parseTaskForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }

  const completedAt = resolveCompletedAt(null, data.status);

  try {
    await getPrisma().task.create({
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status,
        completedAt,
      },
    });
  } catch {
    return { error: "บันทึกงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  redirect("/schedule");
}

export async function updateTask(
  id: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireSession();
  let data: TaskFormInput;
  try {
    data = parseTaskForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }

  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({
        where: { id },
        select: { status: true, completedAt: true },
      });
      if (!current) {
        throw new Error("ไม่พบงานนี้");
      }

      const completedAt = resolveCompletedAt(current, data.status);

      await tx.task.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          dueDate: data.dueDate,
          priority: data.priority,
          status: data.status,
          completedAt,
        },
      });
    });
  } catch {
    return { error: "บันทึกงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  redirect("/schedule");
}

export async function deleteTask(id: string): Promise<void> {
  await requireSession();
  await getPrisma().task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/schedule");
  redirect("/schedule");
}

export async function setTaskStatus(id: string, status: unknown): Promise<void> {
  await requireSession();
  const allowedStatuses = Object.values(TaskStatus) as string[];
  if (typeof status !== "string" || !allowedStatuses.includes(status)) {
    throw new Error("สถานะงานไม่ถูกต้อง");
  }

  const taskStatus = status as TaskStatus;
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const current = await tx.task.findUnique({
      where: { id },
      select: { status: true, completedAt: true },
    });
    if (!current) {
      throw new Error("ไม่พบงานนี้");
    }

    const completedAt = resolveCompletedAt(current, taskStatus);

    await tx.task.update({
      where: { id },
      data: {
        status: taskStatus,
        completedAt,
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/schedule");
}

export async function createShifts(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireSession();
  let data: ShiftCreateInput;
  try {
    data = parseShiftCreateForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }

  try {
    await getPrisma().workShift.createMany({
      data: data.dates.map((dateStr) => ({
        title: data.title,
        date: utcDate(dateStr),
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        notes: data.notes,
      })),
    });
  } catch {
    return { error: "บันทึกกะงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  redirect(`/?month=${data.dates[0].slice(0, 7)}`);
}

export async function updateShift(
  id: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireSession();
  let data: ShiftFormInput;
  try {
    data = parseShiftForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }
  const scope = parseShiftScope(formData.get("scope"));

  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const current = await tx.workShift.findUnique({ where: { id } });
      if (!current) throw new Error("ไม่พบกะงานนี้");
      // Other shifts in the scope keep their own dates; only this shift can move.
      if (scope !== "this") {
        await tx.workShift.updateMany({
          where: { ...seriesWhere(current, scope), id: { not: id } },
          data: {
            title: data.title,
            startTime: data.startTime,
            endTime: data.endTime,
            location: data.location,
            notes: data.notes,
          },
        });
      }
      await tx.workShift.update({
        where: { id },
        data: {
          title: data.title,
          date: utcDate(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          location: data.location,
          notes: data.notes,
        },
      });
    });
  } catch {
    return { error: "บันทึกกะงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  redirect("/schedule");
}

export async function deleteShift(id: string, formData: FormData): Promise<void> {
  await requireSession();
  const scope = parseShiftScope(formData.get("scope"));
  const prisma = getPrisma();
  const current = await prisma.workShift.findUnique({ where: { id } });
  if (current) {
    if (scope === "this") await prisma.workShift.delete({ where: { id } });
    else await prisma.workShift.deleteMany({ where: seriesWhere(current, scope) });
  }
  revalidatePath("/");
  revalidatePath("/schedule");
  redirect("/schedule");
}
