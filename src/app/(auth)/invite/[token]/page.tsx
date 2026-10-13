export const instant = false;

import { InviteForm } from "@/components/auth-forms";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <InviteForm token={token} />
  );
}
