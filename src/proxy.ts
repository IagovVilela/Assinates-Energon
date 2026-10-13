import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATH = [/^\/login$/, /^\/register$/, /^\/forgot-password$/, /^\/reset-password$/, /^\/invite\/[^/]+$/, /^\/api\/webhooks\//, /^\/api\/auth\//];

function hasSession(request: NextRequest) {
  return request.cookies.has("authjs.session-token") || request.cookies.has("__Secure-authjs.session-token");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }
  const isPublic = PUBLIC_PATH.some((pattern) => pattern.test(pathname));
  const signedIn = hasSession(request);
  if (!isPublic && !signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
