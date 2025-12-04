import { withAuthRoute } from '@/lib/server-helpers'
import { handleSearchGuardians } from '@/lib/handlers/search_guardians_handler'

// GET /api/search-guardians?q=...
export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleSearchGuardians(request, user, adminClient)
  )
}

