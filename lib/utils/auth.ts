import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/utils/error';

// ---------------------------------------------------------------------------
// withAuth wrapper — eliminates try/catch boilerplate in route handlers
// ---------------------------------------------------------------------------

type RouteParams = Record<string, string>

type AuthenticatedHandler<P extends RouteParams = RouteParams> = (
  req: NextRequest,
  context: { userId: string; params: P }
) => Promise<Response>

/**
 * Wraps a Next.js route handler with authentication.
 * Calls getAuthenticatedUserId(), resolves route params, and catches auth errors.
 *
 * Before:
 *   export async function GET(req, { params }) {
 *     try {
 *       const userId = await getAuthenticatedUserId();
 *       const { configId } = await params;
 *       // ... route logic
 *     } catch (error) { return handleAuthError(error); }
 *   }
 *
 * After:
 *   export const GET = withAuth(async (req, { userId, params }) => {
 *     const { configId } = params;
 *     // ... route logic — no try/catch needed
 *   });
 */
export function withAuth<P extends RouteParams = RouteParams>(
  handler: AuthenticatedHandler<P>
) {
  return async (
    req: NextRequest,
    routeContext?: { params: Promise<P> | P }
  ): Promise<Response> => {
    try {
      const userId = await getAuthenticatedUserId();
      const params = routeContext?.params
        ? (routeContext.params instanceof Promise
            ? await routeContext.params
            : routeContext.params)
        : ({} as P);
      return await handler(req, { userId, params });
    } catch (error) {
      return handleAuthError(error);
    }
  }
}

// ---------------------------------------------------------------------------
// Core auth functions
// ---------------------------------------------------------------------------

export async function getAuthenticatedUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    throw new UnauthorizedError();
  }

  // Try mapping by externalId first. Only fall back to id match if the Clerk ID is a UUID.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clerkId);
  const mappedById = await prisma.user.findFirst({
    where: isUuid
      ? { OR: [{ externalId: clerkId }, { id: clerkId }] }
      : { externalId: clerkId },
    select: { id: true, email: true }
  });

  if (mappedById) {
    return mappedById.id;
  }

  // Fallback: try to map by email from Clerk
  try {
    const cu = await currentUser();
    const email = cu?.primaryEmailAddress?.emailAddress || cu?.emailAddresses?.[0]?.emailAddress;
    if (email) {
      const mappedByEmail = await prisma.user.findFirst({
        where: { email },
        select: { id: true }
      });
      if (mappedByEmail) {
        return mappedByEmail.id;
      }
    }
  } catch (lookupError) {
    // Best-effort logging for diagnostic purposes
    logError('getAuthenticatedUserId: fetching Clerk user for email fallback', lookupError);
  }

  // Log context to aid diagnosis in environments where mapping is inconsistent
  logError('getAuthenticatedUserId: user not found after mapping attempts', { clerkId });
  throw new UnauthorizedError('User not found');
}

export async function validateUserAccess(resourceUserId: string) {
  const userId = await getAuthenticatedUserId();
  
  if (resourceUserId !== userId) {
    throw new UnauthorizedError('Unauthorized access');
  }
  
  return true;
}

/**
 * Validates if a user has read access to a resource.
 * For read access, any authenticated user is allowed.
 * This allows shared configs/chats to be accessed by users other than the creator.
 * 
 * @returns {Promise<boolean>} Returns true if user is authenticated
 */
export async function validateReadAccess(): Promise<boolean> {
  // Just ensure the user is authenticated but don't check resource ownership
  await getAuthenticatedUserId();
  return true;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function handleAuthError(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  
  console.error('Auth error:', error);
  return NextResponse.json(
    { error: 'Internal server error' }, 
    { status: 500 }
  );
} 