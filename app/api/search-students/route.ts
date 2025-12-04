import { withAuthRoute } from '@/lib/server-helpers'
import { handleSearchStudents } from '@/lib/handlers/search_students_handler'

// GET /api/search-students?q=...
export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleSearchStudents(request, user, adminClient),
  )
}


