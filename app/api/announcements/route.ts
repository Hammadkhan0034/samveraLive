import { withAuthRoute } from '@/lib/server-helpers'
import { handleGetAnnouncements } from '@/lib/handlers/announcement_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user) => handleGetAnnouncements(request, user)
  )
}


