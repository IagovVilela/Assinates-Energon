import { describe, expect, it } from "vitest";

import { isLoginRateLimited, type Attempt } from "@/server/rate-limit";

describe("login rate limit", () => {
  it("blocks the sixth failure inside the window", () => {
    const now = new Date("2026-10-12T12:00:00.000Z");
    const attempts: Attempt[] = Array.from({ length: 5 }, () => ({
      email: "a@example.com",
      success: false,
      createdAt: now,
    }));
    expect(isLoginRateLimited(attempts, "a@example.com", now)).toBe(true);
    expect(isLoginRateLimited(attempts.slice(0, 4), "a@example.com", now)).toBe(false);
  });
});
