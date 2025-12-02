import { NextResponse } from 'next/server';
import { withAuthRoute } from '@/lib/server-helpers';
import { type UserMetadata } from '@/lib/types/auth';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
    },
    async (user) => {
      try {
        const userId = user.id;
        const metadata = user.user_metadata as UserMetadata | undefined;
        const orgId = metadata?.org_id;

        if (!orgId) {
          return NextResponse.json(
            { error: 'Organization ID not found' },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            userId,
            orgId,
          },
          { status: 200 }
        );
      } catch (error) {
        console.error('Error getting user context:', error);
        return NextResponse.json(
          { error: 'Failed to get user context' },
          { status: 500 }
        );
      }
    }
  );
}

