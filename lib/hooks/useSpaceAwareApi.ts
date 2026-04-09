import { useSpace } from '@/lib/contexts/SpaceContext';

/**
 * Hook that wraps fetch to automatically add spaceId to API calls
 */
export function useSpaceAwareApi() {
  const { space } = useSpace();

  const fetchWithSpace = async (url: string, options: RequestInit = {}) => {
    let modifiedUrl = url;
    
    // If we're in a space context, add spaceId to the URL
    if (space) {
      const separator = url.includes('?') ? '&' : '?';
      modifiedUrl = `${url}${separator}spaceId=${space.id}`;
    }

    // For POST/PUT requests, also add spaceId to body
    if (space && options.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      try {
        const body = options.body ? JSON.parse(options.body as string) : {};
        options.body = JSON.stringify({
          ...body,
          spaceId: space.id
        });
      } catch (_e) {
        // If body isn't JSON, leave it as is
      }
    }

    return fetch(modifiedUrl, options);
  };

  return { fetchWithSpace, spaceId: space?.id };
}