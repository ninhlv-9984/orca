import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { matchesWorkspaceTagFilter } from '../../../../shared/worktree/worktree-tags'

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
