import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleGetMessageParticipants,
  handlePostMessageParticipant,
  handlePutMessageParticipant,
  handleDeleteMessageParticipant,
} from '@/lib/handlers/message_participants_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) => handleGetMessageParticipants(request, user, adminClient)
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) => handlePostMessageParticipant(request, user, adminClient)
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) => handlePutMessageParticipant(request, user, adminClient)
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) => handleDeleteMessageParticipant(request, user, adminClient)
  );
}

