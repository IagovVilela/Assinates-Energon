export const instant = false;

import { SignupForm } from "@/components/auth-forms";

export default function RegisterPage() {
  return (
    <main className="p-8">
      <SignupForm />
    </main>
  );
}
