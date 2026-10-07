import type { RuntimeWorkspaceTag } from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { RuntimeClientError } from '../runtime-client'
import { getRequiredStringFlag } from '../flags'
import { getRepeatedTagFlag } from './worktree-tag-flags'
import { formatWorkspaceTags, printResult } from '../format'

export const WORKTREE_TAG_HANDLERS: Record<string, CommandHandler> = {
  'worktree tags': async ({ client, json }) => {
    const result = await client.call<{ tags: RuntimeWorkspaceTag[] }>('worktree.tags')
    printResult(result, json, formatWorkspaceTags)
  },
  'worktree tag-color': async ({ flags, client, json }) => {
    getRequiredStringFlag(flags, 'tag')
    const [tag, ...extra] = getRepeatedTagFlag(flags, 'tag')
    if (extra.length > 0) {
      throw new RuntimeClientError('invalid_argument', 'Pass --tag once; tag-color takes one tag.')
    }
    const result = await client.call<{ tag: string; color: string }>('worktree.setTagColor', {
      tag,
      color: getRequiredStringFlag(flags, 'color')
    })
    printResult(result, json, (value) => `${value.tag}: ${value.color}`)
  }
}
