/**
 * Cache configuration utility for API routes and pages
 * Provides standardized cache headers and revalidation settings
 */

// Cache duration constants (in seconds)
export const CACHE_DURATIONS = {
  // High-frequency, relatively stable data (5 min cache, 10 min stale-while-revalidate)
  STABLE_DATA: {
    sMaxAge: 300, // 5 minutes
    staleWhileRevalidate: 600, // 10 minutes
  },
  // User-specific data (1 min cache, 2 min stale-while-revalidate)
  USER_DATA: {
    sMaxAge: 60, // 1 minute
    staleWhileRevalidate: 120, // 2 minutes
  },
  // Real-time or sensitive data (30 sec cache, 1 min stale-while-revalidate)
  REALTIME_DATA: {
    sMaxAge: 30, // 30 seconds
    staleWhileRevalidate: 60, // 1 minute
  },
  // No cache for highly sensitive or real-time data
  NO_CACHE: {
    sMaxAge: 0,
    staleWhileRevalidate: 0,
  },
} as const;

/**
 * Generate Cache-Control header string
 */
export function getCacheControlHeader(
  sMaxAge: number,
  staleWhileRevalidate: number,
  isPrivate: boolean = false
): string {
  if (sMaxAge === 0) {
    return 'no-store, no-cache, must-revalidate';
  }

  const visibility = isPrivate ? 'private' : 'public';
  return `${visibility}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}

/**
 * Get cache headers for stable data (stories, announcements, menus, etc.)
 */
export function getStableDataCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': getCacheControlHeader(
      CACHE_DURATIONS.STABLE_DATA.sMaxAge,
      CACHE_DURATIONS.STABLE_DATA.staleWhileRevalidate
    ),
  };
}

/**
 * Get cache headers for user-specific data (dashboards, user lists, etc.)
 */
export function getUserDataCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': getCacheControlHeader(
      CACHE_DURATIONS.USER_DATA.sMaxAge,
      CACHE_DURATIONS.USER_DATA.staleWhileRevalidate
    ),
  };
}

/**
 * Get cache headers for real-time data (messages, etc.)
 */
export function getRealtimeDataCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': getCacheControlHeader(
      CACHE_DURATIONS.REALTIME_DATA.sMaxAge,
      CACHE_DURATIONS.REALTIME_DATA.staleWhileRevalidate
    ),
  };
}

/**
 * Get no-cache headers for sensitive or real-time data
 */
export function getNoCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': getCacheControlHeader(0, 0),
  };
}

