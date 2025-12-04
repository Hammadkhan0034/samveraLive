import { withAuthRoute } from '@/lib/server-helpers'
import { handleSearchClasses } from '@/lib/handlers/search_classes_handler'

// GET /api/search-classes?q=...
export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleSearchClasses(request, user, adminClient)
  )
}

