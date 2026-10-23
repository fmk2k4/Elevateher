import { NextResponse } from "next/server";

// Auth is now handled by FastAPI (Bearer JWT) — the frontend sends
// `Authorization: Bearer <token>` on API calls. This middleware is a
// pass-through; route-level protection is enforced by the API gateway.
export const middleware = (req) => {
  return NextResponse.next();
};

export const config = {
  matcher: [
    "/mentor/:path*",
    "/mentee/:path*",
    "/admin/:path*",
    "/institution/:path*",
  ],
};
