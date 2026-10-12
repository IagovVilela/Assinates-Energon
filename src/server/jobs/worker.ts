import { deliverEmail } from "@/server/email";
import { EMAIL_QUEUE, getBoss, WEBHOOK_QUEUE } from "@/server/jobs/boss";
import { prismaWebhookStore } from "@/server/payments/prisma-store";
import { processWebhookEvent } from "@/server/payments/webhooks";
import { log } from "@/lib/log";

let started = false;

export async function ensureWorker() {
  if (started) {
    return;
  }
  started = true;
  const boss = await getBoss();
  await boss.work<{ id: string }>(WEBHOOK_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await processWebhookEvent(prismaWebhookStore(), job.data.id);
    }
  });
  await boss.work<{ to: string; subject: string; text: string }>(EMAIL_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await deliverEmail(job.data);
    }
  });
  log("info", "worker.started", { queues: [WEBHOOK_QUEUE, EMAIL_QUEUE] });
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("worker.ts") || entry.endsWith("worker.js")) {
  ensureWorker().catch((error: unknown) => {
    log("error", "worker.failed", { error: error instanceof Error ? error.message : "unknown" });
    process.exit(1);
  });
}
