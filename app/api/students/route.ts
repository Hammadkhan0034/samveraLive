import { withAuthRoute } from '@/lib/server-helpers'
import {
  handleGetStudents,
  handlePostStudent,
  handlePutStudent,
  handleDeleteStudent,
} from '@/lib/handlers/students_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetStudents(request, user, adminClient)
  )
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handlePostStudent(request, user, adminClient)
  )
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handlePutStudent(request, user, adminClient)
  )
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (_user, adminClient) => handleDeleteStudent(request, _user, adminClient)
  )
}
