export type PlatformRole = "ADMIN" | "CUSTOMER";
export type CompanyRole = "OWNER" | "FINANCE" | "TECHNICAL";

export type Action =
  | "subscription.contract"
  | "subscription.change"
  | "subscription.cancel"
  | "invoice.pay"
  | "invoice.view"
  | "team.invite"
  | "ticket.create"
  | "ticket.reply"
  | "ticket.view"
  | "service.view"
  | "company.manage"
  | "plan.manage"
  | "audit.view"
  | "ticket.internal";

export type Principal = {
  platformRole: PlatformRole;
  companyRole: CompanyRole | null;
};

export function can(user: Principal, action: Action) {
  if (user.platformRole === "ADMIN") {
    return true;
  }

  const role = user.companyRole;
  switch (action) {
    case "subscription.contract":
    case "subscription.change":
    case "subscription.cancel":
    case "team.invite":
      return role === "OWNER";
    case "invoice.pay":
    case "invoice.view":
      return role === "OWNER" || role === "FINANCE";
    case "ticket.create":
    case "ticket.reply":
    case "ticket.view":
    case "service.view":
      return role === "OWNER" || role === "FINANCE" || role === "TECHNICAL";
    case "company.manage":
    case "plan.manage":
    case "audit.view":
    case "ticket.internal":
      return false;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
