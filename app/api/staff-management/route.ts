import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleGetStaff,
  handlePostStaff,
  handlePutStaff,
  handleDeleteStaff,
  handleUpdateStaffStatus,
} from '@/lib/handlers/staff_management_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetStaff(request, user, adminClient),
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handlePostStaff(request, user, adminClient),
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handlePutStaff(request, user, adminClient),
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handleDeleteStaff(request, user, adminClient),
  );
}

export async function PATCH(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handleUpdateStaffStatus(request, user, adminClient),
  );
}
