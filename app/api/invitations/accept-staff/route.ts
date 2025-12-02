import { withAuthRoute } from '@/lib/server-helpers'
import { handleAcceptStaffInvitation } from '@/lib/handlers/invitations_handler'

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
    },
    (user, adminClient) => handleAcceptStaffInvitation(request, user, adminClient)
  )
}
