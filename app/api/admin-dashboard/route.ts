import { withAuthRoute } from '@/lib/server-helpers'
import { handleGetAdminDashboard } from '@/lib/handlers/admin_dashboard_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false, // Admin dashboard shows all orgs, so org is not required
      allowedRoles: ['admin'], // Only admin role can access admin dashboard
    },
    (user, adminClient) => handleGetAdminDashboard(request, user, adminClient)
  )
}

