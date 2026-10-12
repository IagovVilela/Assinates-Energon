import { PgBoss } from "pg-boss";

export const WEBHOOK_QUEUE = "webhook.process";
export const EMAIL_QUEUE = "email.send";

let bossPromise: Promise<PgBoss> | null = null;

async function startBoss() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL missing");
  }
  const boss = new PgBoss({ connectionString });
  await boss.start();
  for (const name of [WEBHOOK_QUEUE, EMAIL_QUEUE]) {
    const existing = await boss.getQueue(name);
    if (!existing) {
      await boss.createQueue(name);
    }
  }
  return boss;
}

export function getBoss() {
  bossPromise ??= startBoss();
  return bossPromise;
}

export async function enqueueWebhook(id: string) {
  const boss = await getBoss();
  const jobId = await boss.send(WEBHOOK_QUEUE, { id });
  if (!jobId) {
    throw new Error("ENQUEUE_FAILED");
  }
}

export async function enqueueEmail(input: { to: string; subject: string; text: string }) {
  const boss = await getBoss();
  const jobId = await boss.send(EMAIL_QUEUE, input);
  if (!jobId) {
    throw new Error("ENQUEUE_FAILED");
  }
}
