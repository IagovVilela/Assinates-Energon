import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(160)
  .regex(/^[^\s@]+@[^\s@]+$/);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});

export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Za-z]/)
  .regex(/[0-9]/);

export const inviteSchema = z.object({
  email: emailField,
  name: z.string().trim().min(2).max(120),
  companyRole: z.enum(["OWNER", "FINANCE", "TECHNICAL"]),
});

export const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  taxId: z.string().trim().min(3).max(32),
  country: z.string().trim().length(2),
  currency: z.enum(["BRL", "USD", "EUR", "GBP"]).optional(),
  locale: z.enum(["PT_BR", "EN"]),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: emailField,
});

export const planSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(2000),
  type: z.enum(["RECURRING", "ONE_TIME"]),
  interval: z.enum(["MONTH", "YEAR"]).optional(),
  brl: z.coerce.number().int().nonnegative(),
  usd: z.coerce.number().int().nonnegative(),
  eur: z.coerce.number().int().nonnegative(),
  gbp: z.coerce.number().int().nonnegative(),
  active: z.boolean(),
});

export const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(8000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const replySchema = z.object({
  body: z.string().trim().min(1).max(8000),
});
