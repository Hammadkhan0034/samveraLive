import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { type SamveraRole } from '@/lib/auth';

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

export async function middleware(req: NextRequest) {
  try {
    const { pathname, searchParams } = req.nextUrl;

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

    // Get the current session
    const { data: { session }, error } = await supabase.auth.getSession();

    // If not signed in → /signin (preserve ?next)
    if (error || !session?.user) {
      console.log('No session found, redirecting to signin');
      const url = req.nextUrl.clone();
      url.pathname = '/signin';
      if (!searchParams.get('next')) {
        url.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(url);
    }

    const userRoles = (session.user.user_metadata?.roles || []) as SamveraRole[];
    const activeRole = session.user.user_metadata?.activeRole as SamveraRole | undefined;

    // Validate user has at least one role
    if (userRoles.length === 0) {
      console.log('User has no roles, redirecting to signin');
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
        console.log(`Access denied to ${pathname}. User roles: ${userRoles.join(', ')}`);
        
        // Redirect to user's highest privilege dashboard
        const userMaxLevel = Math.max(...userRoles.map((role: SamveraRole) => ROLE_HIERARCHY[role] || 0));
        const highestRole = userRoles.find((role: SamveraRole) => ROLE_HIERARCHY[role] === userMaxLevel) as SamveraRole;
        
        const url = req.nextUrl.clone();
        url.pathname = ROLE_PATHS[highestRole];
        return NextResponse.redirect(url);
      }
    }

    // Add user context to headers for server components
    res.headers.set('x-user-id', session.user.id);
    res.headers.set('x-user-roles', JSON.stringify(userRoles));
    res.headers.set('x-user-active-role', activeRole || userRoles[0]);

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, redirect to signin
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    return NextResponse.redirect(url);
  }
}

export const config = { 
  // Apply middleware to all dashboard routes
  matcher: ['/dashboard/:path*']
};
