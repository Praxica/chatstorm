import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/share/(.*)',
  '/preview/(.*)',
  '/api/shares/(.*)', // The GET share endpoint is public, other methods require auth
  '/api/templates/(.*)', // GET for templates should be public
  '/api/preview/(.*)' // API for previews (GET for config, messages, agents should be public)
]);

export default clerkMiddleware(async (auth, request) => {
  const url = new URL(request.url);
  
  // Space routes work correctly now
  
  // For non-GET requests to /api/shares, /api/templates, and /api/preview, require authentication
  if (
    (request.url.includes('/api/shares/') || request.url.includes('/api/templates/') || request.url.includes('/api/preview/')) &&
    request.method !== 'GET'
  ) {
    await auth.protect();
  }
  // For other non-public routes, require authentication
  else if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - files with extensions (e.g. .png, .jpg, .ico, .txt)
     * - public folder
     */
    '/((?!_next/static|_next/image|.*\\.[\\w]+$|public/).*)',
    '/',
    '/(api|trpc)(.*)'
  ]
};