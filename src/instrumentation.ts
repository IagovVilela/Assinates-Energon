export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.START_WORKER === "false" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }
  const { ensureWorker } = await import("@/server/jobs/worker");
  await ensureWorker();
}
