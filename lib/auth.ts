// /lib/auth.ts
export type SamveraRole = 'teacher' | 'principal' | 'admin' | 'guardian' | 'parent';

// Re-export UserMetadata from types
export type { UserMetadata } from './types/auth';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setAuth(email: string, roles: SamveraRole[], activeRole?: SamveraRole) {
  const cleanRoles = Array.from(new Set(roles));
  const chosen = activeRole && cleanRoles.includes(activeRole) ? activeRole : cleanRoles[0];
  setCookie('samvera_email', email);
  setCookie('samvera_roles', JSON.stringify(cleanRoles));
  setCookie('samvera_active_role', chosen);
}

export function getAuth() {
  const email = getCookie('samvera_email');
  const rolesRaw = getCookie('samvera_roles');
  const active = getCookie('samvera_active_role') as SamveraRole | null;
  const roles = rolesRaw ? (JSON.parse(rolesRaw) as SamveraRole[]) : [];
  return { email, roles, active };
}

export function switchRole(nextRole: SamveraRole) {
  setCookie('samvera_active_role', nextRole);
}

export function signOut() {
  // expire cookies
  if (typeof document === 'undefined') return;
  document.cookie = `samvera_email=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `samvera_roles=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `samvera_active_role=; Path=/; Max-Age=0; SameSite=Lax`;
}

export const ROLE_PATHS = {
  teacher: '/dashboard/teacher',
  principal: '/dashboard/principal',
  guardian: '/dashboard/guardian',
  parent: '/dashboard/guardian',
  admin: '/dashboard/admin',
} as const;

export function routeForRole(role: SamveraRole): string {
  return ROLE_PATHS[role as keyof typeof ROLE_PATHS];
}

export function getActiveRole(): SamveraRole | null {
  const auth = getAuth();
  return auth.active || null;
}

export function getRoles(): SamveraRole[] {
  const auth = getAuth();
  return auth.roles;
}
