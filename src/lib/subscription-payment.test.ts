import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

import { getPrisma } from "@/lib/prisma";
import { recordSubscriptionPayment } from "@/lib/subscription-payment";

const SUB_ID = "cmh7k2x9b0000abcd1234efgh";
const tx = {
  subscription: { findUnique: vi.fn(), updateMany: vi.fn() },
  payment: { create: vi.fn() },
  reminder: { updateMany: vi.fn() },
};

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    name: "Netflix",
    price: 419,
    currency: "THB",
    status: "ACTIVE",
    nextDueDate: new Date("2026-11-15T00:00:00.000Z"),
    intervalCount: 1,
    intervalUnit: "MONTH",
    billingDay: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue({ $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as never);
  tx.subscription.findUnique.mockResolvedValue(subscription());
  tx.subscription.updateMany.mockResolvedValue({ count: 1 });
  tx.payment.create.mockResolvedValue({});
  tx.reminder.updateMany.mockResolvedValue({ count: 0 });
});

describe("recordSubscriptionPayment", () => {
  it("records the current cycle and advances the due date", async () => {
    const result = await recordSubscriptionPayment(SUB_ID, "2026-11-15");
    expect(result).toEqual({
      ok: true,
      name: "Netflix",
      amount: 419,
      currency: "THB",
      coveredDueDate: "2026-11-15",
      nextDueDate: "2026-12-15",
    });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ subscriptionId: SUB_ID, coveredDueDate: new Date("2026-11-15T00:00:00.000Z") }),
    });
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: SUB_ID, nextDueDate: new Date("2026-11-15T00:00:00.000Z") },
      data: { nextDueDate: new Date("2026-12-15T00:00:00.000Z") },
    });
  });

  it("does not pay a later cycle when the reminder's cycle was already paid", async () => {
    tx.subscription.findUnique.mockResolvedValue(subscription({ nextDueDate: new Date("2026-12-15T00:00:00.000Z") }));
    expect(await recordSubscriptionPayment(SUB_ID, "2026-11-15")).toEqual({ ok: false, reason: "already_paid" });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("treats a duplicate payment or a lost race as already paid", async () => {
    tx.payment.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await recordSubscriptionPayment(SUB_ID)).toEqual({ ok: false, reason: "already_paid" });
    tx.subscription.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await recordSubscriptionPayment(SUB_ID)).toEqual({ ok: false, reason: "already_paid" });
  });

  it("refuses missing and inactive subscriptions", async () => {
    tx.subscription.findUnique.mockResolvedValueOnce(null);
    expect(await recordSubscriptionPayment(SUB_ID)).toEqual({ ok: false, reason: "not_found" });
    tx.subscription.findUnique.mockResolvedValueOnce(subscription({ status: "PAUSED" }));
    expect(await recordSubscriptionPayment(SUB_ID)).toEqual({ ok: false, reason: "inactive" });
  });
});
