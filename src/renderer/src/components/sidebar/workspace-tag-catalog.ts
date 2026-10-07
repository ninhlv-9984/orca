import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/selectors'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  matchesWorkspaceTagFilter,
  workspaceTagKey
} from '../../../../shared/worktree/worktree-tags'

export type WorkspaceTagEntry = {
  /** First-seen casing. */
  name: string
  /** Lowercase key shared by the filter, colors and matching. */
  key: string
  /** Workspaces carrying the tag. */
  count: number
}

export type WorkspaceTagCatalog = {
  tags: WorkspaceTagEntry[]
  /** Non-archived workspaces considered, for "visible/total". */
  totalWorkspaces: number
  /** Workspaces carrying at least one tag of the filter (all of them when the filter is empty). */
  matchingWorkspaces: number
}

/** Tags are derived (no separate tag list): a tag exists while a workspace carries it. */
export function collectWorkspaceTagCatalog(
  worktrees: readonly Pick<Worktree, 'tags' | 'isArchived'>[],
  folderWorkspaces: readonly Pick<FolderWorkspace, 'tags'>[],
  filterTags: readonly string[] = []
): WorkspaceTagCatalog {
  const byKey = new Map<string, WorkspaceTagEntry>()
  let totalWorkspaces = 0
  let matchingWorkspaces = 0
  const visit = (tags: readonly string[] | undefined): void => {
    totalWorkspaces += 1
    if (matchesWorkspaceTagFilter(tags, filterTags)) {
      matchingWorkspaces += 1
    }
    for (const name of tags ?? []) {
      const key = workspaceTagKey(name)
      const entry = byKey.get(key)
      if (entry) {
        entry.count += 1
      } else {
        byKey.set(key, { name, key, count: 1 })
      }
    }
  }
  for (const worktree of worktrees) {
    if (!worktree.isArchived) {
      visit(worktree.tags)
    }
  }
  for (const folderWorkspace of folderWorkspaces) {
    visit(folderWorkspace.tags)
  }
  const tags = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { tags, totalWorkspaces, matchingWorkspaces }
}

export function useWorkspaceTagCatalog(): WorkspaceTagCatalog {
  const worktrees = useAllWorktrees()
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const filterTags = useAppStore((s) => s.filterTags)
  return useMemo(
    () => collectWorkspaceTagCatalog(worktrees, folderWorkspaces, filterTags),
    [worktrees, folderWorkspaces, filterTags]
  )
}
