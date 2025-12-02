import { withAuthRoute } from '@/lib/server-helpers'
import {
  handleGetGuardians,
  handlePostGuardian,
  handlePutGuardian,
  handleDeleteGuardian,
} from '@/lib/handlers/guardians_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleGetGuardians(request, user, adminClient)
  )
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handlePostGuardian(request, user, adminClient)
  )
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handlePutGuardian(request, user, adminClient)
  )
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleDeleteGuardian(request, user, adminClient)
  )
}
