import { withAuthRoute } from '@/lib/server-helpers'
import { handleSearchPeople } from '@/lib/handlers/search_people_handler'

// GET /api/search-people?q=...&role=guardian|student|all&mode=email|name|any&limit=10
export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) => handleSearchPeople(request, user, adminClient)
  )
}


