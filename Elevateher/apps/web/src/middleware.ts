import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const middleware = auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  // Protect admin routes
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/account/login', req.url));
    }
    const role = req.auth?.user?.role;
    if (role !== 'admin' && role !== 'institution_admin' && role !== 'moderator') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Protect mentor routes
  if (nextUrl.pathname.startsWith('/mentor')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/account/login', req.url));
    }
    if (req.auth?.user?.role !== 'mentor') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Protect mentee routes
  if (nextUrl.pathname.startsWith('/mentee')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/account/login', req.url));
    }
    if (req.auth?.user?.role !== 'mentee') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
});

export const config = {
  matcher: [
    "/mentor/:path*",
    "/mentee/:path*",
    "/admin/:path*",
    "/institution/:path*",
  ],
};
