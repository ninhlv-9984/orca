import {
  addWorkspaceTags,
  removeWorkspaceTags,
  validateWorkspaceTag,
  workspaceTagKey
} from '../../../../shared/worktree/worktree-tags'

export type WorkspaceTagSubmitResult =
  | { kind: 'error'; error: string }
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
    return query.trim() === '' ? { kind: 'noop' } : { kind: 'error', error: validation.error }
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
