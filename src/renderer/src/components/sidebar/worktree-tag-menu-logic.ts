import { describeWorkspaceTagError } from './workspace-tag-error-messages'
import {
  addWorkspaceTags,
  removeWorkspaceTags,
  validateWorkspaceTag,
  workspaceTagKey
} from '../../../../shared/worktree/worktree-tags'

export type WorkspaceTagSubmitResult =
  | { kind: 'error'; message: string }
  | { kind: 'noop' }
  | { kind: 'set'; tags: string[] }

/**
 * Enter in the Tags submenu: create the typed tag (or reuse an existing tag's casing) and apply it.
 * Applying a tag the workspace already has is a no-op rather than a toggle, so Enter never removes.
 */
export function resolveWorkspaceTagSubmit(
  query: string,
  currentTags: readonly string[] | undefined,
  knownTagNames: readonly string[]
): WorkspaceTagSubmitResult {
  const validation = validateWorkspaceTag(query)
  if (!validation.ok) {
    // Why: an empty box is "nothing typed yet", not an error worth shouting about.
    return query.trim() === ''
      ? { kind: 'noop' }
      : {
          kind: 'error',
          message: describeWorkspaceTagError(validation.code, query.trim(), validation.error)
        }
  }
  const key = workspaceTagKey(validation.tag)
  if ((currentTags ?? []).some((tag) => workspaceTagKey(tag) === key)) {
    return { kind: 'noop' }
  }
  const existingName = knownTagNames.find((name) => workspaceTagKey(name) === key)
  return {
    kind: 'set',
    tags: addWorkspaceTags(currentTags, [existingName ?? validation.tag]) ?? []
  }
}

export function toggleWorkspaceTag(
  currentTags: readonly string[] | undefined,
  tag: string
): string[] {
  const key = workspaceTagKey(tag)
  const has = (currentTags ?? []).some((entry) => workspaceTagKey(entry) === key)
  return (
    (has ? removeWorkspaceTags(currentTags, [tag]) : addWorkspaceTags(currentTags, [tag])) ?? []
  )
}

/** Filter tags to drop after a tag was removed from the last workspace carrying it, so the filter cannot go stale. */
export function filterTagsToDropAfterRemoval(
  filterTags: readonly string[],
  removedTags: readonly string[],
  carrierCountByKey: ReadonlyMap<string, number>
): string[] {
  const dropped = new Set(
    removedTags.map(workspaceTagKey).filter((key) => (carrierCountByKey.get(key) ?? 0) <= 1)
  )
  return filterTags.filter((tag) => dropped.has(workspaceTagKey(tag)))
}
