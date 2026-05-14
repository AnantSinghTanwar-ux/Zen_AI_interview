import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // Paths that require authentication
  const protectedPaths = [
    '/dashboard',
    '/interview',
    '/dsa-interview',
    '/job-prep',
    '/feedback',
    '/call-data',
    '/recruiter'
  ];

  // Check if current path requires auth
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // If trying to access a protected path without a session cookie, redirect to /sign-in
  if (isProtectedPath && !session) {
    const redirectUrl = new URL('/sign-in', request.url);
    // Optionally preserve the original destination to redirect back after sign in
    redirectUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Paths that are ONLY for unauthenticated users (like sign-in, sign-up)
  const authPaths = ['/sign-in', '/sign-up'];
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // If trying to access sign-in/sign-up while ALREADY authenticated, redirect to /dashboard
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - images, svg, css (public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
