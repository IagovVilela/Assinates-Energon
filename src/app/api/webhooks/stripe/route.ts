import { log } from "@/lib/log";
import { enqueueWebhook } from "@/server/jobs/boss";
import { getGateway } from "@/server/payments/gateway";
import { acceptWebhookEvent } from "@/server/payments/webhooks";
import { prismaWebhookStore } from "@/server/payments/prisma-store";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const gateway = getGateway("STRIPE");
    const verified = gateway.parseWebhook(request.headers, rawBody);
    const accepted = await acceptWebhookEvent(prismaWebhookStore(), {
      gateway: "STRIPE",
      externalId: verified.externalId,
      payload: { event: verified.event },
    });
    if (!accepted.duplicate) {
      await enqueueWebhook(accepted.id);
    }
    return Response.json({ ok: true, duplicate: accepted.duplicate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WEBHOOK_FAILED";
    if (message === "WEBHOOK_SIGNATURE_MISSING") {
      return Response.json({ ok: false }, { status: 400 });
    }
    log("error", "webhook.stripe", { message });
    return Response.json({ ok: false }, { status: 500 });
  }
}
