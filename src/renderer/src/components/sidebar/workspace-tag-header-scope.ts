import type { Worktree } from '../../../../shared/worktree/types'

/**
 * Under a tag filter, rows that carry no tags (imported/inbox notice cards, in-progress
 * creates) must not keep an otherwise empty project header alive. A repo only keeps its
 * notices when it still has a worktree row after filtering; lineage ancestors shown for
 * context count, because their row already renders the header.
 */
export function scopeRepoKeyedToTagFilter<T>(
  byRepo: ReadonlyMap<string, T>,
  visibleWorktrees: readonly Worktree[],
  filterTags: readonly string[] | undefined
): ReadonlyMap<string, T> {
  if (!filterTags || filterTags.length === 0 || byRepo.size === 0) {
    return byRepo
  }
  const visibleRepoIds = new Set(visibleWorktrees.map((worktree) => worktree.repoId))
  return new Map([...byRepo].filter(([repoId]) => visibleRepoIds.has(repoId)))
}

export function scopePendingCreationsToTagFilter<T extends { repoId: string }>(
  pendingCreations: readonly T[],
  visibleWorktrees: readonly Worktree[],
  filterTags: readonly string[] | undefined
): readonly T[] {
  if (!filterTags || filterTags.length === 0 || pendingCreations.length === 0) {
    return pendingCreations
  }
  const visibleRepoIds = new Set(visibleWorktrees.map((worktree) => worktree.repoId))
  return pendingCreations.filter((creation) => visibleRepoIds.has(creation.repoId))
}
