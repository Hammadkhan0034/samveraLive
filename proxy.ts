import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { type SamveraRole, type UserMetadata } from '@/lib/auth';

const ROLE_PATHS: Record<SamveraRole, string> = {
  teacher: '/dashboard/teacher',
  principal: '/dashboard/principal',
  parent: '/dashboard/parent',
  admin: '/dashboard/admin',
};

// Role hierarchy for access control
const ROLE_HIERARCHY: Record<SamveraRole, number> = {
  admin: 4,
  principal: 3,
  teacher: 2,
  parent: 1,
};

// Protected routes and their required roles
const PROTECTED_ROUTES = [
  { path: '/dashboard/teacher', roles: ['teacher', 'principal', 'admin'] },
  { path: '/dashboard/principal/students', roles: ['principal'] },
  { path: '/dashboard/principal', roles: ['principal', 'admin'] },
  { path: '/dashboard/parent', roles: ['parent'] },
  { path: '/dashboard/admin', roles: ['admin'] },
] as const;

export async function proxy(req: NextRequest) {
  try {
    const { pathname, searchParams } = req.nextUrl;

    // Handle sign-in route - redirect authenticated users
    if (pathname === '/signin') {
      // Create a Supabase client configured to use cookies
      const res = NextResponse.next();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                req.cookies.set(name, value);
                res.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      // Get the current user (authenticates with server - secure)
      const { data: { user }, error } = await supabase.auth.getUser();

      // Handle fetch/network errors differently from authentication errors
      if (error) {
        // Check if it's a network/fetch error (retryable) vs auth error
        const isNetworkError = error.message?.includes('fetch failed') || 
                             error.message?.includes('timeout') ||
                             error.name === 'AuthRetryableFetchError' ||
                             error.status === 0;
        
        if (isNetworkError) {
          // For network errors, allow request to continue - client-side will handle retry
          return res;
        }
        
        // For actual auth errors (not network), allow access to sign-in page
        return res;
      }

      // If user is authenticated, redirect to their dashboard
      if (user) {
        const userMetadata = user.user_metadata as UserMetadata | undefined;
        const userRoles = (userMetadata?.roles || []) as SamveraRole[];
        const activeRole = userMetadata?.activeRole as SamveraRole | undefined;

        // If user has roles, redirect to appropriate dashboard
        if (userRoles.length > 0 || activeRole) {
          const preferredRole: SamveraRole = (activeRole && userRoles.includes(activeRole))
            ? activeRole
            : userRoles.length > 0
            ? userRoles[0]
            : 'parent'; // fallback
          
          const url = req.nextUrl.clone();
          url.pathname = ROLE_PATHS[preferredRole];
          return NextResponse.redirect(url);
        }
      }

      // If no user or no roles, allow access to sign-in page
      return res;
    }

    // Only protect dashboard routes
    if (!pathname.startsWith('/dashboard')) {
      return NextResponse.next();
    }

    // Create a Supabase client configured to use cookies
    const res = NextResponse.next();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Get the current user (authenticates with server - secure)
    const { data: { user }, error } = await supabase.auth.getUser();

    // Handle fetch/network errors differently from authentication errors
    if (error) {
      // Check if it's a network/fetch error (retryable) vs auth error
      const isNetworkError = error.message?.includes('fetch failed') || 
                           error.message?.includes('timeout') ||
                           error.name === 'AuthRetryableFetchError' ||
                           error.status === 0;
      
      if (isNetworkError) {
        // For network errors, allow request to continue - client-side will handle retry
        // Don't redirect on network failures as user might still be authenticated
        return res;
      }
      
      // For actual auth errors (not network), redirect to signin
      const url = req.nextUrl.clone();
      url.pathname = '/signin';
      if (!searchParams.get('next')) {
        url.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(url);
    }

    // If no user and no error (shouldn't happen, but handle it)
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = '/signin';
      if (!searchParams.get('next')) {
        url.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(url);
    }

    const userMetadata = user.user_metadata as UserMetadata | undefined;
    const userRoles = (userMetadata?.roles || []) as SamveraRole[];
    const activeRole = userMetadata?.activeRole as SamveraRole | undefined;

    // Validate user has at least one role
    if (userRoles.length === 0) {
      const url = req.nextUrl.clone();
      url.pathname = '/signin';
      return NextResponse.redirect(url);
    }

    // /dashboard → redirect to appropriate role dashboard
    if (pathname === '/dashboard') {
      const preferredRole: SamveraRole = (activeRole && userRoles.includes(activeRole))
        ? activeRole
        : userRoles[0];
      
      const url = req.nextUrl.clone();
      url.pathname = ROLE_PATHS[preferredRole];
      return NextResponse.redirect(url);
    }

    // Check if user has access to the requested dashboard
    const route = PROTECTED_ROUTES.find(r => pathname.startsWith(r.path));
    
    if (route) {
      const hasAccess = route.roles.some((role) => userRoles.includes(role as SamveraRole));
      
      if (!hasAccess) {
        // Redirect to user's highest privilege dashboard
        const userMaxLevel = Math.max(...userRoles.map((role: SamveraRole) => ROLE_HIERARCHY[role] || 0));
        const highestRole = userRoles.find((role: SamveraRole) => ROLE_HIERARCHY[role] === userMaxLevel) as SamveraRole;
        
        const url = req.nextUrl.clone();
        url.pathname = ROLE_PATHS[highestRole];
        return NextResponse.redirect(url);
      }
    }

    // Add user context to headers for server components
    res.headers.set('x-user-id', user.id);
    res.headers.set('x-user-roles', JSON.stringify(userRoles));
    res.headers.set('x-user-active-role', activeRole || userRoles[0]);

    return res;
  } catch (error: any) {
    // Check if it's a network/fetch error
    const isNetworkError = error?.message?.includes('fetch failed') || 
                          error?.message?.includes('timeout') ||
                          error?.name === 'AuthRetryableFetchError' ||
                          error?.status === 0;
    
    if (isNetworkError) {
      // For network errors, allow request to continue
      return NextResponse.next();
    }
    
    // On other errors, redirect to signin
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    return NextResponse.redirect(url);
  }
}

export const config = { 
  // Apply proxy to signin and all dashboard routes
  matcher: ['/signin', '/dashboard/:path*']
};

