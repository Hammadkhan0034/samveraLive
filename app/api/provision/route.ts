import { withAuthRoute } from '@/lib/server-helpers'
import { handlePostProvision } from '@/lib/handlers/provision_handler'

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false, // This endpoint creates the org, so org is not required
    },
    (user, adminClient) => handlePostProvision(request, user, adminClient)
  )
}


