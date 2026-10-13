export const instant = false;

import { ResetForm } from "@/components/auth-forms";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <ResetForm token={params.token ?? ""} />
  );
}
