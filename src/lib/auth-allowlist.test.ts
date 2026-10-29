import { describe, expect, it } from "vitest";
import { isAllowedGoogleAccount } from "@/lib/auth-allowlist";

describe("Google account allowlist", () => {
  it("allows a verified account whose normalized email is listed", () => {
    expect(
      isAllowedGoogleAccount(" Owner@Example.com ", true, "owner@example.com,other@example.com"),
    ).toBe(true);
  });

  it("denies an unverified or unlisted account", () => {
    expect(isAllowedGoogleAccount("owner@example.com", false, "owner@example.com")).toBe(false);
    expect(isAllowedGoogleAccount("guest@example.com", true, "owner@example.com")).toBe(false);
  });

  it("denies every account when the allowlist is empty", () => {
    expect(isAllowedGoogleAccount("owner@example.com", true, " ")).toBe(false);
  });
});
