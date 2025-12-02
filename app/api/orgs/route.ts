import { withAuthRoute } from '@/lib/server-helpers'
import {
  handleGetOrgs,
  handlePostOrg,
  handlePutOrg,
  handleDeleteOrg,
} from '@/lib/handlers/orgs_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['admin'],
    },
    (user, adminClient) => handleGetOrgs(request, user, adminClient)
  )
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['admin'],
    },
    (user, adminClient) => handlePostOrg(request, user, adminClient)
  )
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['admin'],
    },
    (_user, adminClient) => handlePutOrg(request, adminClient)
  )
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['admin'],
    },
    (_user, adminClient) => handleDeleteOrg(request, adminClient)
  )
}


