import { NextRequest, NextResponse } from "next/server";

// Routes that require a valid session
const PROTECTED_ROUTES = ["/dashboard", "/apply", "/status", "/notifications", "/card"];

// Routes only accessible to guests (redirect logged-in users away)
const GUEST_ONLY_ROUTES = ["/login", "/signup"];

// In Next.js 16+, this must be named "proxy" (replaces "middleware")
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read session token from cookie (set by auth-store.ts on successful login)
  const sessionToken = request.cookies.get("aid_session")?.value;
  const isAuthenticated = !!sessionToken;

  // Protect private routes — redirect to login
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from login/signup
  const isGuestOnly = GUEST_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  if (isGuestOnly && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
