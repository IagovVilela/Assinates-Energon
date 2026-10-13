import { AuthBrand } from "@/components/company-brand";
import { RouteTransition } from "@/components/route-transition";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <AuthBrand />
        <RouteTransition>{children}</RouteTransition>
      </div>
    </div>
  );
}
