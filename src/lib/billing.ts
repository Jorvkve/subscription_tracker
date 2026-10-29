export type BillingUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type RecurringCost = {
  amount: number;
  currency: string;
  intervalCount: number;
  intervalUnit: BillingUnit;
};
export type CostTotals = Record<string, { monthly: number; annual: number }>;

function assertInterval(intervalCount: number) {
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new RangeError("Billing interval must be a positive whole number.");
  }
}

export function monthlyEquivalent(
  amount: number,
  intervalCount: number,
  intervalUnit: BillingUnit,
): number {
  assertInterval(intervalCount);
  const monthsPerInterval = {
    DAY: (intervalCount * 12) / 365.2425,
    WEEK: (intervalCount * 12) / 52,
    MONTH: intervalCount,
    YEAR: intervalCount * 12,
  }[intervalUnit];

  return amount / monthsPerInterval;
}

export function annualEquivalent(
  amount: number,
  intervalCount: number,
  intervalUnit: BillingUnit,
): number {
  return monthlyEquivalent(amount, intervalCount, intervalUnit) * 12;
}

export function groupCostTotals(costs: readonly RecurringCost[]): CostTotals {
  return costs.reduce<CostTotals>((totals, cost) => {
    const current = totals[cost.currency] ?? { monthly: 0, annual: 0 };
    current.monthly += monthlyEquivalent(cost.amount, cost.intervalCount, cost.intervalUnit);
    current.annual = current.monthly * 12;
    totals[cost.currency] = current;
    return totals;
  }, {});
}

export function advanceDueDate(
  dueDate: string,
  intervalCount: number,
  intervalUnit: BillingUnit,
  billingDay?: number | null,
): string {
  assertInterval(intervalCount);
  const [year, month, day] = dueDate.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(current.getTime()) ||
    current.toISOString().slice(0, 10) !== dueDate
  ) {
    throw new RangeError("Due date must be a valid YYYY-MM-DD date.");
  }

  if (intervalUnit === "DAY" || intervalUnit === "WEEK") {
    const daysToAdd = intervalCount * (intervalUnit === "WEEK" ? 7 : 1);
    current.setUTCDate(current.getUTCDate() + daysToAdd);
    return current.toISOString().slice(0, 10);
  }

  const targetMonth =
    current.getUTCFullYear() * 12 +
    current.getUTCMonth() +
    intervalCount * (intervalUnit === "YEAR" ? 12 : 1);
  const targetYear = Math.floor(targetMonth / 12);
  const targetMonthIndex = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const anchorDay = billingDay ?? current.getUTCDate();
  const targetDay = Math.min(Math.max(1, anchorDay), lastDay);

  return new Date(Date.UTC(targetYear, targetMonthIndex, targetDay))
    .toISOString()
    .slice(0, 10);
}
