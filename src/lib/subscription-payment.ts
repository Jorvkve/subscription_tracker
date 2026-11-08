import "server-only";
import { ReminderEmailStatus, SubscriptionStatus } from "@/generated/prisma/client";
import { advanceDueDate } from "@/lib/billing";
import { dateOnly, utcDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export type PaymentResult =
  | { ok: true; name: string; amount: number; currency: string; coveredDueDate: string; nextDueDate: string }
  | { ok: false; reason: "not_found" | "inactive" | "already_paid" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Records a payment for the subscription's current due date and moves it to the next cycle.
 * With `expectedDueDate`, it pays only that cycle, so a stale or repeated tap cannot pay the next one.
 */
export async function recordSubscriptionPayment(id: string, expectedDueDate?: string): Promise<PaymentResult> {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({ where: { id } });
      if (!subscription) return { ok: false, reason: "not_found" } as const;
      if (subscription.status !== SubscriptionStatus.ACTIVE) return { ok: false, reason: "inactive" } as const;

      const coveredDueDate = dateOnly(subscription.nextDueDate);
      if (expectedDueDate !== undefined && expectedDueDate !== coveredDueDate) {
        return { ok: false, reason: "already_paid" } as const;
      }
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
      // Conditional on the due date, so two concurrent payments cannot both advance it.
      const moved = await tx.subscription.updateMany({
        where: { id: subscription.id, nextDueDate: subscription.nextDueDate },
        data: { nextDueDate: utcDate(nextDueDate) },
      });
      if (moved.count === 0) throw new AlreadyPaidError();
      await tx.reminder.updateMany({
        where: {
          subscriptionId: subscription.id,
          dueDate: utcDate(coveredDueDate),
          emailStatus: { in: [ReminderEmailStatus.NOT_QUEUED, ReminderEmailStatus.PENDING] },
        },
        data: { emailStatus: ReminderEmailStatus.SKIPPED },
      });
      await tx.reminder.updateMany({
        where: { subscriptionId: subscription.id, dueDate: utcDate(coveredDueDate), status: "UNREAD" },
        data: { status: "READ", readAt: new Date() },
      });
      return {
        ok: true,
        name: subscription.name,
        amount: Number(subscription.price),
        currency: subscription.currency,
        coveredDueDate,
        nextDueDate,
      } as const;
    });
  } catch (error) {
    if (error instanceof AlreadyPaidError || isUniqueViolation(error)) return { ok: false, reason: "already_paid" };
    throw error;
  }
}

class AlreadyPaidError extends Error {}
