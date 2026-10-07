import { RuntimeClientError } from '../runtime-client'
import { getOptionalStringFlag, getRepeatedStringFlag } from '../flags'
import { validateWorkspaceTag } from '../../shared/worktree/worktree-tags'

type TagUpdate = { tags?: string[] | null; addTags?: string[]; removeTags?: string[] }

function validateTags(values: string[]): string[] {
  return values.map((value) => {
    const result = validateWorkspaceTag(value)
    if (!result.ok) {
      throw new RuntimeClientError('invalid_argument', result.error)
    }
    return result.tag
  })
}

/** Repeatable `--tag` as a `worktree.ps` OR filter. */
export function getWorktreeTagFilterFlag(flags: Map<string, string | boolean>): string[] {
  return validateTags(getRepeatedStringFlag(flags, 'tag'))
}

/** `--tag` / `--untag` / `--tags` as `worktree.set` params; absent leaves tags unchanged. */
export function getWorktreeTagUpdateFlags(flags: Map<string, string | boolean>): TagUpdate {
  const addTags = getWorktreeTagFilterFlag(flags)
  const removeTags = validateTags(getRepeatedStringFlag(flags, 'untag'))
  const replacement = getOptionalStringFlag(flags, 'tags')
  if (flags.has('tags') && replacement === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--tags needs a comma-separated list, or null to clear all tags.'
    )
  }
  return {
    ...(replacement === undefined
      ? {}
      : { tags: replacement === 'null' ? null : validateTags(replacement.split(',')) }),
    ...(addTags.length > 0 ? { addTags } : {}),
    ...(removeTags.length > 0 ? { removeTags } : {})
  }
}
