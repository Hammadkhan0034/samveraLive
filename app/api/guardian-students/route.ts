import { withAuthRoute } from '@/lib/server-helpers'
import {
  handleGetGuardianStudents,
  handlePostGuardianStudent,
  handleDeleteGuardianStudent,
} from '@/lib/handlers/guardian_students_handler'

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal',  'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetGuardianStudents(request, user, adminClient)
  )
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handlePostGuardianStudent(request, user, adminClient)
  )
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handleDeleteGuardianStudent(request, user, adminClient)
  )
}
