import { describe, expect, it, vi } from "vitest";
import { describeError, withRetry } from "@/lib/retry";

describe("withRetry", () => {
  it("returns the first success", async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error("busy")).mockResolvedValue("ok");
    await expect(withRetry(task, { delaysMs: [0, 0] })).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last delay and rethrows the last error", async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error("one")).mockRejectedValueOnce(new Error("two")).mockRejectedValue(new Error("three"));
    await expect(withRetry(task, { delaysMs: [0, 0] })).rejects.toThrow("three");
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("stops at once for an error that will not pass", async () => {
    const task = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(withRetry(task, { delaysMs: [0, 0], shouldRetry: () => false })).rejects.toThrow("fatal");
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe("describeError", () => {
  it("keeps the name, code, and first line of the message", () => {
    const error = Object.assign(new Error("Unique constraint failed\nquery details"), { code: "P2002" });
    expect(describeError(error)).toBe("Error P2002 Unique constraint failed");
    expect(describeError("text")).toBe("unknown");
  });
});
