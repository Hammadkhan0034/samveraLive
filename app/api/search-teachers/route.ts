import { withAuthRoute } from '@/lib/server-helpers'
import { handleSearchTeachers } from '@/lib/handlers/search_teachers_handler'

// GET /api/search-teachers?q=...&mode=email|name|any&limit=10&excludeIds=...
export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleSearchTeachers(request, user, adminClient)
  )
}

