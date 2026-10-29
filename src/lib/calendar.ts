import { advanceDueDate, type BillingUnit } from "@/lib/billing";

export type CalendarEventKind = "DUE" | "OVERDUE" | "PROJECTED" | "PAID";

export type CalendarSubscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  intervalCount: number;
  intervalUnit: BillingUnit;
  billingDay: number | null;
  nextDueDate: string;
};

export type CalendarPayment = {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  amount: number;
  currency: string;
  coveredDueDate: string;
};

export type CalendarEvent = {
  id: string;
  subscriptionId: string;
  name: string;
  amount: number;
  currency: string;
  date: string;
  kind: CalendarEventKind;
  intervalCount?: number;
  intervalUnit?: BillingUnit;
};

function parseMonth(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new RangeError("Month must use YYYY-MM format.");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { year, monthNumber, dayCount, start: `${month}-01`, end: `${month}-${String(dayCount).padStart(2, "0")}` };
}

export function calendarGrid(month: string): (string | null)[][] {
  const { year, monthNumber, dayCount } = parseMonth(month);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - firstWeekday + 1;
      return day >= 1 && day <= dayCount ? `${month}-${String(day).padStart(2, "0")}` : null;
    }),
  );
}

export function buildCalendarEvents(input: {
  month: string;
  today: string;
  subscriptions: readonly CalendarSubscription[];
  payments: readonly CalendarPayment[];
}): CalendarEvent[] {
  const { start, end } = parseMonth(input.month);
  const events: CalendarEvent[] = [];

  for (const subscription of input.subscriptions) {
    let dueDate = subscription.nextDueDate;
    if (dueDate < input.today) {
      if (dueDate >= start && dueDate <= end) {
        events.push({
          id: `overdue-${subscription.id}-${dueDate}`,
          subscriptionId: subscription.id,
          name: subscription.name,
          amount: subscription.amount,
          currency: subscription.currency,
          date: dueDate,
          kind: "OVERDUE",
          intervalCount: subscription.intervalCount,
          intervalUnit: subscription.intervalUnit,
        });
      }
      continue;
    }

    let projected = false;
    let occurrences = 0;
    while (dueDate <= end && occurrences < 500) {
      if (dueDate >= start) {
        events.push({
          id: `${subscription.id}-${dueDate}`,
          subscriptionId: subscription.id,
          name: subscription.name,
          amount: subscription.amount,
          currency: subscription.currency,
          date: dueDate,
          kind: projected ? "PROJECTED" : "DUE",
          intervalCount: subscription.intervalCount,
          intervalUnit: subscription.intervalUnit,
        });
      }
      const nextDate = advanceDueDate(
        dueDate,
        subscription.intervalCount,
        subscription.intervalUnit,
        subscription.billingDay,
      );
      if (nextDate <= dueDate) throw new RangeError("Billing interval did not advance the date.");
      dueDate = nextDate;
      projected = true;
      occurrences += 1;
    }
  }

  for (const payment of input.payments) {
    if (payment.coveredDueDate >= start && payment.coveredDueDate <= end) {
      events.push({
        id: `paid-${payment.id}`,
        subscriptionId: payment.subscriptionId,
        name: payment.subscriptionName,
        amount: payment.amount,
        currency: payment.currency,
        date: payment.coveredDueDate,
        kind: "PAID",
      });
    }
  }

  return events.sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
}
