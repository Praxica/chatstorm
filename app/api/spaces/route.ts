import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { logError } from '@/lib/utils/error';
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';

// GET /api/spaces - Get user's spaces
export async function GET(_req: NextRequest) {
  try {
    // Use the existing auth service to get normalized internal user ID
    const userId = await getAuthenticatedUserId();
    
    console.log('[SPACES_API] Fetching spaces for internal userId:', userId);
    const spaces = await SpaceService.getUserSpaces(userId);
    console.log('[SPACES_API] Found spaces:', spaces.length, spaces.map(s => ({ name: s.name, role: s.userRole })));

    return new Response(JSON.stringify({ spaces }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError('GET /api/spaces', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch spaces' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/spaces - Create new space
export async function POST(req: NextRequest) {
  try {
    // Use the existing auth service to get normalized internal user ID
    const userId = await getAuthenticatedUserId();

    const body = await req.json();
    const { 
      name, 
      slug: providedSlug,
      description, 
      settings,
      badgeIcon,
      signupMode = 'approval',
      allowedEmailDomain,
      joinInstructions
    } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use provided slug or generate one
    const slug = providedSlug || await SpaceService.generateSlug(name);
    
    // Validate slug format
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug)) {
      return new Response(JSON.stringify({ 
        error: 'Space URL can only contain lowercase letters, numbers, and hyphens' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const space = await SpaceService.createSpace(userId, {
      name,
      slug,
      description,
      type: 'class', // Default type - we can change this later if needed
      settings,
      badgeIcon,
      signupMode,
      allowedEmailDomain,
      joinInstructions
    });

    return new Response(JSON.stringify({ space }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError('POST /api/spaces', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create space' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}