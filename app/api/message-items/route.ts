import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleDeleteMessageItem,
  handleGetMessageItems,
  handlePostMessageItem,
  handlePutMessageItem,
} from '@/lib/handlers/message_items_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetMessageItems(request, user, adminClient),
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePostMessageItem(request, user, adminClient),
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePutMessageItem(request, user, adminClient),
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleDeleteMessageItem(request, user, adminClient),
  );
}

