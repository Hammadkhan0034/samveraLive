import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleGetPrincipals,
  handlePostPrincipal,
  handlePutPrincipal,
  handleDeletePrincipal,
} from '@/lib/handlers/principals_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handleGetPrincipals(request, user, adminClient),
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handlePostPrincipal(request, user, adminClient),
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (_user, adminClient) => handlePutPrincipal(request, _user, adminClient),
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (_user, adminClient) => handleDeletePrincipal(request, _user, adminClient),
  );
}


