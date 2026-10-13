import { ViewTransition } from "react";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      default="page-fade"
      enter="page-enter"
      exit="page-exit"
    >
      <div className="route-page">{children}</div>
    </ViewTransition>
  );
}
