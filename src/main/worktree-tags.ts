import type { Store } from './persistence'
import { pickColorsForUncoloredWorkspaceTags } from '../shared/worktree/worktree-tags'

type TagColorStore = { getUI?: Store['getUI']; updateUI?: Store['updateUI'] }

/** Gives every tag without a color one; main-side so CLI/agent-created tags are colored too. */
export function ensureWorkspaceTagColors(
  store: TagColorStore,
  tags: readonly string[] | undefined,
  random?: () => number
): void {
  if (!tags?.length || !store.getUI || !store.updateUI) {
    return
  }
  const added = pickColorsForUncoloredWorkspaceTags(
    tags,
    store.getUI().worktreeTagColors ?? {},
    random
  )
  if (Object.keys(added).length > 0) {
    // Why: updateUI notifies UI listeners, which pushes the new colors to open renderers.
    store.updateUI({ worktreeTagColors: added })
  }
}

/** Overlays the stored tags (e.g. just inherited) on a worktree projected before they were written. */
export function withStoredWorkspaceTags<T extends { id: string }>(
  store: { getWorktreeMeta?: Store['getWorktreeMeta'] },
  worktree: T
): T & { tags?: string[] } {
  const tags = store.getWorktreeMeta?.(worktree.id)?.tags
  return tags ? { ...worktree, tags } : worktree
}

/** A workspace created under a parent starts with the parent's tags. */
export function inheritWorkspaceTags(
  store: TagColorStore & { setWorktreeMeta: Store['setWorktreeMeta'] },
  childWorktreeId: string,
  parentTags: readonly string[] | undefined
): string[] | undefined {
  if (!parentTags?.length) {
    return undefined
  }
  const written = store.setWorktreeMeta(childWorktreeId, { tags: [...parentTags] })
  ensureWorkspaceTagColors(store, written.tags)
  return written.tags
}
