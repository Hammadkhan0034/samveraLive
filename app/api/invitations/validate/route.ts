import { withAuthRoute } from '@/lib/server-helpers'
import { handleValidateInvitation } from '@/lib/handlers/invitations_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: [],
    },
    (user, adminClient) => handleValidateInvitation(request, user, adminClient)
  )
}
