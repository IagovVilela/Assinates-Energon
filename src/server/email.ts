import { Resend } from "resend";

import { log } from "@/lib/log";

export async function deliverEmail(input: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    log("info", "email.skipped", input);
    return;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
}
