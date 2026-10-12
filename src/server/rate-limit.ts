const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export type Attempt = { email: string; success: boolean; createdAt: Date };

export function isLoginRateLimited(attempts: Attempt[], email: string, now = new Date()) {
  const cutoff = now.getTime() - WINDOW_MS;
  const failures = attempts.filter(
    (attempt) =>
      attempt.email === email.toLowerCase() &&
      !attempt.success &&
      attempt.createdAt.getTime() >= cutoff,
  );
  return failures.length >= MAX_FAILURES;
}
