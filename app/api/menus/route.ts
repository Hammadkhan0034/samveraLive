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
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user) => handleGetMenus(request, user)
  )
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user) => handlePostMenu(request, user)
  )
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    () => handlePutMenu(request)
  )
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    () => handleDeleteMenu(request)
  )
}

