import { describe, expect, it } from "vitest";

import { can, type Action, type Principal } from "@/server/permissions";

const actions: Action[] = [
  "subscription.contract",
  "subscription.change",
  "subscription.cancel",
  "invoice.pay",
  "invoice.view",
  "team.invite",
  "ticket.create",
  "ticket.reply",
  "ticket.view",
  "service.view",
  "company.manage",
  "plan.manage",
  "audit.view",
  "ticket.internal",
];

function principal(role: Principal["companyRole"]): Principal {
  return { platformRole: "CUSTOMER", companyRole: role };
}

describe("permissions", () => {
  it("gives the admin every action", () => {
    const admin: Principal = { platformRole: "ADMIN", companyRole: null };
    for (const action of actions) {
      expect(can(admin, action)).toBe(true);
    }
  });

  it("lets only the owner change billing and invite people", () => {
    expect(can(principal("OWNER"), "subscription.cancel")).toBe(true);
    expect(can(principal("FINANCE"), "subscription.cancel")).toBe(false);
    expect(can(principal("TECHNICAL"), "team.invite")).toBe(false);
    expect(can(principal("FINANCE"), "invoice.pay")).toBe(true);
    expect(can(principal("TECHNICAL"), "invoice.view")).toBe(false);
    expect(can(principal("TECHNICAL"), "ticket.reply")).toBe(true);
    expect(can(principal("OWNER"), "ticket.internal")).toBe(false);
  });
});
