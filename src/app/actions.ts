"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingUnit, ReminderEmailStatus, SubscriptionStatus } from "@/generated/prisma/client";
import { advanceDueDate } from "@/lib/billing";
import { dateOnly, utcDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type SubscriptionInput = {
  name: string;
  category: string;
  price: number;
  currency: string;
  intervalCount: number;
  intervalUnit: BillingUnit;
  billingDay: number | null;
  nextDueDate: Date;
  status: SubscriptionStatus;
  paymentMethod: string | null;
  notes: string | null;
};

export type FormActionState = { error?: string };

function parseSubscription(formData: FormData): SubscriptionInput {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "Other").trim() || "Other";
  const price = Number(formData.get("price"));
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const intervalCount = Number(formData.get("intervalCount"));
  const intervalUnit = String(formData.get("intervalUnit")) as BillingUnit;
  const billingDayValue = String(formData.get("billingDay") ?? "").trim();
  const billingDay = billingDayValue ? Number(billingDayValue) : null;
  const dueDateValue = String(formData.get("nextDueDate") ?? "");
  const status = String(formData.get("status")) as SubscriptionStatus;
  const allowedUnits = Object.values(BillingUnit) as string[];
  const allowedStatuses = Object.values(SubscriptionStatus) as string[];
  const dueDate = new Date(`${dueDateValue}T00:00:00.000Z`);

  if (!name || name.length > 100) throw new Error("กรุณาระบุชื่อบริการไม่เกิน 100 ตัวอักษร");
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000_000) {
    throw new Error("กรุณาระบุราคาที่ถูกต้อง");
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("สกุลเงินต้องเป็นรหัส 3 ตัวอักษร");
  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 120) {
    throw new Error("รอบบิลต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 120");
  }
  if (!allowedUnits.includes(intervalUnit)) throw new Error("หน่วยรอบบิลไม่ถูกต้อง");
  if (billingDay !== null && (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)) {
    throw new Error("วันตัดรอบต้องอยู่ระหว่าง 1 ถึง 31");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue) ||
    Number.isNaN(dueDate.getTime()) ||
    dueDate.toISOString().slice(0, 10) !== dueDateValue
  ) {
    throw new Error("กรุณาระบุวันครบกำหนดที่ถูกต้อง");
  }
  if (!allowedStatuses.includes(status)) throw new Error("สถานะไม่ถูกต้อง");

  return {
    name,
    category,
    price,
    currency,
    intervalCount,
    intervalUnit,
    billingDay,
    nextDueDate: dueDate,
    status,
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createSubscription(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireSession();
  let data: SubscriptionInput;
  try {
    data = parseSubscription(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }
  try {
    await getPrisma().subscription.create({ data });
  } catch {
    return { error: "บันทึกรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/");
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function updateSubscription(id: string, _previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireSession();
  let data: SubscriptionInput;
  try {
    data = parseSubscription(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ตรวจสอบข้อมูลอีกครั้ง" };
  }
  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const current = await tx.subscription.findUnique({
        where: { id },
        select: { nextDueDate: true },
      });
      if (!current) throw new Error("ไม่พบรายการ Subscription นี้");
      const previousDueDate = dateOnly(current.nextDueDate);
      await tx.subscription.update({ where: { id }, data });
      if (previousDueDate !== dateOnly(data.nextDueDate)) {
        await tx.reminder.updateMany({
          where: {
            subscriptionId: id,
            dueDate: current.nextDueDate,
            emailStatus: { in: [ReminderEmailStatus.NOT_QUEUED, ReminderEmailStatus.PENDING] },
          },
          data: { emailStatus: ReminderEmailStatus.SKIPPED },
        });
        await tx.reminder.updateMany({
          where: {
            subscriptionId: id,
            dueDate: current.nextDueDate,
            status: "UNREAD",
          },
          data: { status: "READ", readAt: new Date() },
        });
      }
    });
  } catch {
    return { error: "บันทึกรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/");
  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${id}`);
  redirect(`/subscriptions/${id}`);
}

export async function deleteSubscription(id: string) {
  await requireSession();
  await getPrisma().subscription.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function markPaid(id: string) {
  await requireSession();
  const prisma = getPrisma();
  try {
    await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { id } });
    if (!subscription) throw new Error("ไม่พบรายการ Subscription นี้");
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new Error("บันทึกการชำระได้เฉพาะรายการที่กำลังใช้งาน");
    }

    const coveredDueDate = dateOnly(subscription.nextDueDate);
    const nextDueDate = advanceDueDate(
      coveredDueDate,
      subscription.intervalCount,
      subscription.intervalUnit,
      subscription.billingDay,
    );

    await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: subscription.price,
        currency: subscription.currency,
        coveredDueDate: utcDate(coveredDueDate),
      },
    });
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { nextDueDate: utcDate(nextDueDate) },
    });
    await tx.reminder.updateMany({
      where: {
        subscriptionId: subscription.id,
        dueDate: utcDate(coveredDueDate),
        emailStatus: { in: [ReminderEmailStatus.NOT_QUEUED, ReminderEmailStatus.PENDING] },
      },
      data: { emailStatus: ReminderEmailStatus.SKIPPED },
    });
    await tx.reminder.updateMany({
      where: {
        subscriptionId: subscription.id,
        dueDate: utcDate(coveredDueDate),
        status: "UNREAD",
      },
      data: { status: "READ", readAt: new Date() },
    });
    });
  } catch {
    redirect(`/subscriptions/${id}?error=payment`);
  }

  revalidatePath("/");
  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${id}`);
  redirect(`/subscriptions/${id}?paid=1`);
}

export async function markReminderRead(id: string) {
  await requireSession();
  await getPrisma().reminder.update({
    where: { id },
    data: { status: "READ", readAt: new Date() },
  });
  revalidatePath("/");
}

\n