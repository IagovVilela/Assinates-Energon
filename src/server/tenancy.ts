export type CompanyRecord = {
  id: string;
  companyId: string;
};

type FindMany<T> = (args: { where: { companyId: string } }) => Promise<T[]>;
type FindFirst<T> = (args: { where: { id: string; companyId: string } }) => Promise<T | null>;

export type CompanyScopedDb = {
  subscription: {
    findMany: FindMany<CompanyRecord>;
    findFirst: FindFirst<CompanyRecord>;
  };
  invoice: {
    findMany: FindMany<CompanyRecord>;
    findFirst: FindFirst<CompanyRecord>;
  };
  ticket: {
    findMany: FindMany<CompanyRecord>;
    findFirst: FindFirst<CompanyRecord>;
  };
};

export function companyData(db: CompanyScopedDb, companyId: string) {
  if (!companyId) {
    throw new Error("companyId is required");
  }

  return {
    listSubscriptions: () => db.subscription.findMany({ where: { companyId } }),
    getSubscription: (id: string) => db.subscription.findFirst({ where: { id, companyId } }),
    listInvoices: () => db.invoice.findMany({ where: { companyId } }),
    getInvoice: (id: string) => db.invoice.findFirst({ where: { id, companyId } }),
    listTickets: () => db.ticket.findMany({ where: { companyId } }),
    getTicket: (id: string) => db.ticket.findFirst({ where: { id, companyId } }),
  };
}
