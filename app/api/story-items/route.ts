import { withAuthRoute } from '@/lib/server-helpers'
import { handleGetStoryItems } from '@/lib/handlers/story_items_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) => handleGetStoryItems(request, user, adminClient)
  )
}


