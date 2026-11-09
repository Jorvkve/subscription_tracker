"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { detectImageType, parseSlipForm, slipDriveFileName, validateSlipFile } from "@/lib/slip-input";
import {
  DriveAuthError,
  DriveNotConnectedError,
  trashSlip,
  uploadSlip,
} from "@/lib/google-drive";
import { appDateString, appTimeString, utcDate } from "@/lib/dates";
import { parseBudgetForm } from "@/lib/budget";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { isSlipOcrConfigured, readSlip, type SlipReading } from "@/lib/slip-ocr";
import type { FormActionState } from "@/app/actions";

function driveErrorMessage(error: unknown): string {
  if (error instanceof DriveNotConnectedError || error instanceof DriveAuthError) {
    return error.message;
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function sanitizeFileName(name: string): string {
  return name.slice(0, 200).replace(/[^\w\s\-_.ก-๙]/g, "_");
}

export async function createSlip(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireSession();

  let parsed;
  try {
    parsed = parseSlipForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }

  const fileRaw = formData.get("slipFile");
  // The image is optional: an empty file input arrives as a File of size 0.
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;

  let bytes: Uint8Array | null = null;
  let contentType: string | null = null;
  if (file) {
    try {
      validateSlipFile(file);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ตรวจสอบไฟล์อีกครั้ง" };
    }
    // Read bytes and detect type from actual content
    bytes = new Uint8Array(await file.arrayBuffer());
    contentType = detectImageType(bytes);
    if (!contentType) {
      return { error: "ประเภทไฟล์ไม่รองรับ กรุณาใช้ไฟล์ JPEG, PNG หรือ WebP" };
    }
  }

  // Verify subscription exists if provided
  if (parsed.subscriptionId) {
    const sub = await getPrisma().subscription.findUnique({
      where: { id: parsed.subscriptionId },
      select: { id: true },
    });
    if (!sub) {
      return { error: "ไม่พบ Subscription ที่เลือก" };
    }
  }

  let image: { driveFileId: string; fileName: string; contentType: string; sizeBytes: number } | null = null;
  if (file && bytes && contentType) {
    // Generate a server-side Drive file name (ignore user's file name for Drive)
    const driveName = slipDriveFileName(parsed.paidDate, parsed.paidTime, contentType);
    try {
      image = {
        driveFileId: await uploadSlip(bytes, driveName, contentType),
        // Keep sanitized original name in fileName
        fileName: file.name ? sanitizeFileName(file.name) : driveName,
        contentType,
        sizeBytes: bytes.length,
      };
    } catch (error) {
      return { error: driveErrorMessage(error) };
    }
  }

  try {
    await getPrisma().expenseSlip.create({
      data: {
        ...image,
        amount: parsed.amount,
        currency: parsed.currency,
        paidDate: utcDate(parsed.paidDate),
        paidTime: parsed.paidTime,
        payee: parsed.payee,
        category: parsed.category,
        note: parsed.note,
        subscriptionId: parsed.subscriptionId,
      },
    });
  } catch {
    // Best-effort cleanup: trash the Drive file
    if (image) {
      try {
        await trashSlip(image.driveFileId);
      } catch {
        // Log only sanitized info, never expose tokens
        console.error("[createSlip] Failed to trash Drive file after DB error");
      }
    }
    return { error: "บันทึกสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/slips");
  redirect("/slips");
}

export async function updateSlip(
  id: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireSession();

  let parsed;
  try {
    parsed = parseSlipForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }

  // Verify subscription exists if provided
  if (parsed.subscriptionId) {
    const sub = await getPrisma().subscription.findUnique({
      where: { id: parsed.subscriptionId },
      select: { id: true },
    });
    if (!sub) {
      return { error: "ไม่พบ Subscription ที่เลือก" };
    }
  }

  try {
    const existing = await getPrisma().expenseSlip.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { error: "ไม่พบสลิปนี้" };
    }

    await getPrisma().expenseSlip.update({
      where: { id },
      data: {
        amount: parsed.amount,
        currency: parsed.currency,
        paidDate: utcDate(parsed.paidDate),
        paidTime: parsed.paidTime,
        payee: parsed.payee,
        category: parsed.category,
        note: parsed.note,
        subscriptionId: parsed.subscriptionId,
      },
    });
  } catch {
    return { error: "บันทึกสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/slips");
  revalidatePath(`/slips/${id}`);
  redirect(`/slips/${id}`);
}

export async function deleteSlip(id: string): Promise<void> {
  await requireSession();

  let driveFileId: string | null = null;

  const slip = await getPrisma().expenseSlip.findUnique({
    where: { id },
    select: { driveFileId: true },
  });

  if (slip) {
    driveFileId = slip.driveFileId;
    try {
      await getPrisma().expenseSlip.delete({ where: { id } });
    } catch {
      redirect("/slips");
    }
  }

  // Best-effort: trash the Drive file
  if (driveFileId) {
    try {
      await trashSlip(driveFileId);
    } catch {
      // A Drive failure must not bring the row back; log only sanitized message
      console.error("[deleteSlip] Failed to trash Drive file; row already deleted");
    }
  }

  revalidatePath("/slips");
  redirect("/slips");
}

/** Money Tracker quick add: an image-less THB expense for today in one of the bot's categories. */
export async function quickAddExpense(formData: FormData): Promise<void> {
  await requireSession();
  const category = String(formData.get("category") ?? "");
  let parsed;
  try {
    if (!EXPENSE_CATEGORIES.some((item) => item.key === category)) throw new Error("หมวดหมู่ไม่ถูกต้อง");
    const input = new FormData();
    input.set("amount", String(formData.get("amount") ?? ""));
    input.set("currency", "THB");
    input.set("paidDate", appDateString());
    input.set("paidTime", appTimeString());
    input.set("payee", String(formData.get("payee") ?? ""));
    input.set("category", category);
    parsed = parseSlipForm(input);
    await getPrisma().expenseSlip.create({
      data: {
        amount: parsed.amount,
        currency: parsed.currency,
        paidDate: utcDate(parsed.paidDate),
        paidTime: parsed.paidTime,
        payee: parsed.payee,
        category: parsed.category,
      },
    });
  } catch {
    redirect("/slips?quick=error");
  }
  revalidatePath("/");
  revalidatePath("/slips");
  redirect("/slips?quick=saved");
}

export type SlipReadState = { reading?: SlipReading; error?: string };

/** Reads the chosen image so the form can be pre-filled. Nothing is stored. */
export async function readSlipImage(formData: FormData): Promise<SlipReadState> {
  await requireSession();
  if (!isSlipOcrConfigured()) return { error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" };

  const fileRaw = formData.get("slipFile");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  try {
    validateSlipFile(file);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบไฟล์อีกครั้ง" };
  }
  const bytes = new Uint8Array(await file!.arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType) return { error: "ประเภทไฟล์ไม่รองรับ กรุณาใช้ไฟล์ JPEG, PNG หรือ WebP" };

  const reading = await readSlip(bytes, contentType, appDateString());
  return reading ? { reading } : { error: "อ่านสลิปไม่ได้ กรุณากรอกเอง" };
}

/** Saves the monthly budget per category; an empty field removes that budget. */
export async function saveBudgets(formData: FormData): Promise<void> {
  await requireSession();
  const back = String(formData.get("month") ?? "");
  const month = /^\d{4}-\d{2}$/.test(back) ? back : null;
  const suffix = month ? `&month=${month}` : "";
  let budgets;
  try {
    budgets = parseBudgetForm(formData);
  } catch {
    redirect(`/slips?budget=error${suffix}`);
  }
  const prisma = getPrisma();
  await prisma.$transaction(
    Object.entries(budgets).map(([category, amount]) =>
      amount === null
        ? prisma.categoryBudget.deleteMany({ where: { category } })
        : prisma.categoryBudget.upsert({ where: { category }, create: { category, amount }, update: { amount } }),
    ),
  );
  revalidatePath("/");
  revalidatePath("/slips");
  redirect(`/slips?budget=saved${suffix}`);
}
