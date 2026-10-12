import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { NormalizedEvent } from "@/server/payments/types";
import type { WebhookStore } from "@/server/payments/webhooks";

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function prismaWebhookStore(): WebhookStore {
  return {
    isUnique,
    async create(input) {
      const row = await prisma.webhookEvent.create({
        data: {
          gateway: input.gateway,
          externalId: input.externalId,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
      return { id: row.id };
    },
    async find(gateway, externalId) {
      return prisma.webhookEvent.findUnique({
        where: { gateway_externalId: { gateway, externalId } },
        select: { id: true },
      });
    },
    async getEvent(id) {
      const row = await prisma.webhookEvent.findUnique({ where: { id } });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        gateway: row.gateway,
        externalId: row.externalId,
        payload: row.payload as { event: NormalizedEvent },
        status: row.status,
        attempts: row.attempts,
      };
    },
    async markProcessed(id) {
      await prisma.webhookEvent.update({
        where: { id },
        data: { status: "PROCESSED", lastError: null },
      });
    },
    async markFailed(id, error, attempts) {
      await prisma.webhookEvent.update({
        where: { id },
        data: { status: "FAILED", lastError: error, attempts },
      });
    },
    async findSubscriptionByExternal(gateway, externalId) {
      return prisma.subscription.findUnique({
        where: { gateway_externalId: { gateway, externalId } },
      });
    },
    async findSubscriptionById(id) {
      return prisma.subscription.findUnique({ where: { id } });
    },
    async updateSubscription(id, data) {
      await prisma.subscription.update({ where: { id }, data });
    },
    async findInvoiceCompany(gateway, externalId) {
      const invoice = await prisma.invoice.findUnique({
        where: { gateway_externalId: { gateway, externalId } },
        select: { companyId: true },
      });
      return invoice?.companyId ?? null;
    },
    async upsertInvoice(input) {
      await prisma.invoice.upsert({
        where: { gateway_externalId: { gateway: input.gateway, externalId: input.externalId } },
        create: input,
        update: {
          status: input.status,
          amountMinor: input.amountMinor,
          dueDate: input.dueDate,
          paymentUrl: input.paymentUrl,
          pdfUrl: input.pdfUrl,
          subscriptionId: input.subscriptionId,
          planId: input.planId,
        },
      });
    },
  };
}
