import { withAuthRoute } from '@/lib/server-helpers'
import {
  handleDeleteMenu,
  handleGetMenus,
  handlePostMenu,
  handlePutMenu,
} from '@/lib/handlers/menus_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetMenus(request, user, adminClient)
  )
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePostMenu(request, user, adminClient)
  )
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (_user, adminClient) => handlePutMenu(request, adminClient)
  )
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (_user, adminClient) => handleDeleteMenu(request, adminClient)
  )
}

