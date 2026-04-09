import { NextRequest } from 'next/server';

/**
 * Extracts spaceId from request (query param or header)
 * This allows existing routes to become space-aware with minimal changes
 */
export function getSpaceId(req: Request | NextRequest): string | null {
  try {
    // Check URL params
    const url = new URL(req.url);
    const spaceId = url.searchParams.get('spaceId');
    if (spaceId) return spaceId;

    // Check headers (set by middleware or client)
    const headers = req.headers;
    const headerSpaceId = headers.get('x-space-id');
    if (headerSpaceId) return headerSpaceId;

    return null;
  } catch {
    return null;
  }
}

/**
 * Modifies a Prisma where clause to include spaceId filtering
 * Keeps existing logic intact, just adds space filtering when needed
 */
export function addSpaceFilter<T extends Record<string, unknown>>(
  whereClause: T,
  spaceId: string | null
): T & { spaceId: string | null } {
  if (spaceId) {
    return { ...whereClause, spaceId };
  }
  // When not in space context, exclude space items by default
  return { ...whereClause, spaceId: null };
}