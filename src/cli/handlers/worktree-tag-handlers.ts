import type { RuntimeWorkspaceTag } from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { formatWorkspaceTags, printResult } from '../format'

export const WORKTREE_TAG_HANDLERS: Record<string, CommandHandler> = {
  'worktree tags': async ({ client, json }) => {
    const result = await client.call<{ tags: RuntimeWorkspaceTag[] }>('worktree.tags')
    printResult(result, json, formatWorkspaceTags)
  },
  'worktree tag-color': async ({ flags, client, json }) => {
    const result = await client.call<{ tag: string; color: string }>('worktree.setTagColor', {
      tag: getRequiredStringFlag(flags, 'tag'),
      color: getRequiredStringFlag(flags, 'color')
    })
    printResult(result, json, (value) => `${value.tag}: ${value.color}`)
  }
}
