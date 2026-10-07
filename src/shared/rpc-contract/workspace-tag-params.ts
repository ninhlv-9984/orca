import { z } from 'zod'
import { validateWorkspaceTag, WORKSPACE_TAG_COLOR_IDS } from '../worktree/worktree-tags'

export const WorkspaceTagSchema = z.string().superRefine((value, ctx) => {
  const result = validateWorkspaceTag(value)
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error })
  }
})

export const WorkspaceTagColorSchema = z.enum(WORKSPACE_TAG_COLOR_IDS)
