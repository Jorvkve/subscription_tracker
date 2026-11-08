import type { ReminderEmailStatus, SubscriptionStatus } from "@/generated/prisma/client";
import { addDays } from "@/lib/dates";

export const REMINDER_OFFSETS = [7, 3, 1] as const;

export function dueReminderOffsets(today: string, dueDate: string): number[] {
  return REMINDER_OFFSETS.filter((offset) => addDays(today, offset) === dueDate);
}

export function reminderMatchesDueDate(reminderDueDate: string, currentDueDate: string): boolean {
  return reminderDueDate === currentDueDate;
}

/** True while a reminder is still for the subscription's current cycle and today is its send day. */
export function reminderSendable(input: {
  subscriptionStatus: SubscriptionStatus;
  dueDate: string;
  currentDueDate: string;
  today: string;
  daysBefore: number;
}): boolean {
  return input.subscriptionStatus === "ACTIVE" &&
    reminderMatchesDueDate(input.dueDate, input.currentDueDate) &&
    input.dueDate >= input.today &&
    dueReminderOffsets(input.today, input.dueDate).includes(input.daysBefore);
}

export function reminderEmailEligible(input: {
  emailStatus: ReminderEmailStatus;
  subscriptionStatus: SubscriptionStatus;
  dueDate: string;
  currentDueDate: string;
  today: string;
  daysBefore: number;
}): boolean {
  const isSendableStatus = input.emailStatus === "NOT_QUEUED" || input.emailStatus === "PENDING";
  return isSendableStatus && reminderSendable(input);
}
