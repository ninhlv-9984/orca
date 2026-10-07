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

/** A workspace created under a parent starts with the parent's tags. */
export function inheritWorkspaceTags(
  store: TagColorStore & { setWorktreeMeta: Store['setWorktreeMeta'] },
  childWorktreeId: string,
  parentTags: readonly string[] | undefined
): void {
  if (!parentTags?.length) {
    return
  }
  const written = store.setWorktreeMeta(childWorktreeId, { tags: [...parentTags] })
  ensureWorkspaceTagColors(store, written.tags)
}
