import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";
import { getObject } from "@/server/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { message: { include: { ticket: true } } },
  });
  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }
  const sameCompany = user.companyId && user.companyId === attachment.message.ticket.companyId;
  if (user.platformRole !== "ADMIN" && !sameCompany) {
    return new Response("Forbidden", { status: 403 });
  }
  if (user.platformRole !== "ADMIN" && attachment.message.visibility === "INTERNAL") {
    return new Response("Forbidden", { status: 403 });
  }
  const body = await getObject(attachment.storageKey);
  return new Response(body, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": `attachment; filename="${attachment.filename.replaceAll('"', "")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
