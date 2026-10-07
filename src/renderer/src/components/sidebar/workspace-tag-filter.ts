import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import {
  matchesWorkspaceTagFilter,
  workspaceTagKey
} from '../../../../shared/worktree/worktree-tags'

/** Folder workspaces are not part of computeVisibleWorktrees, so the tag filter narrows them here. */
export function filterFolderWorkspacesByTags(
  workspaces: readonly FolderWorkspace[],
  filterTags: readonly string[] | undefined
): readonly FolderWorkspace[] {
  if (!filterTags || filterTags.length === 0) {
    return workspaces
  }
  return workspaces.filter((workspace) => matchesWorkspaceTagFilter(workspace.tags, filterTags))
}

/**
 * Drops filter tags that no workspace carries any more, mirroring how repo filters shed removed repos.
 * Only tags seen earlier in this session are dropped, so a persisted tag is never pruned before workspaces load.
 */
export function pruneVanishedFilterTags(
  filterTags: readonly string[],
  previouslyKnownKeys: ReadonlySet<string>,
  currentKeys: ReadonlySet<string>
): readonly string[] {
  const retained = filterTags.filter((tag) => {
    const key = workspaceTagKey(tag)
    return currentKeys.has(key) || !previouslyKnownKeys.has(key)
  })
  return retained.length === filterTags.length ? filterTags : retained
}
