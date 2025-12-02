import { withAuthRoute } from '@/lib/server-helpers'
import { handlePostStoryItems, handleDeleteStoryItems } from '@/lib/handlers/stories_handler'
import { validateParams, storyIdSchema } from '@/lib/validation'
import { z } from 'zod'

// Path parameter schema
const storyIdParamsSchema = z.object({
  storyId: storyIdSchema,
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const rawParams = await params
  const paramsValidation = validateParams(storyIdParamsSchema, rawParams)
  if (!paramsValidation.success) {
    return paramsValidation.error
  }
  const { storyId } = paramsValidation.data

  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePostStoryItems(request, user, adminClient, storyId)
  )
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const rawParams = await params
  const paramsValidation = validateParams(storyIdParamsSchema, rawParams)
  if (!paramsValidation.success) {
    return paramsValidation.error
  }
  const { storyId } = paramsValidation.data

  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleDeleteStoryItems(request, user, adminClient, storyId)
  )
}
