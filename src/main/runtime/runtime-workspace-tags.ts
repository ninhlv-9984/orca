import {
  normalizeWorkspaceTag,
  workspaceTagKey,
  type WorkspaceTagColorId
} from '../../shared/worktree/worktree-tags'
import type { RuntimeWorkspaceTag } from '../../shared/runtime-worktree-contracts'
import { ensureWorkspaceTagColors } from '../worktree-tags'
import type { RuntimeStore } from './runtime-store-contract'

/** Every tag carried by at least one workspace, sorted by name case-insensitively. */
export function listRuntimeWorkspaceTags(store: RuntimeStore): RuntimeWorkspaceTag[] {
  const tagLists = [
    ...Object.values(store.getAllWorktreeMeta()).map((meta) => meta.tags),
    ...(store.getFolderWorkspaces?.() ?? []).map((workspace) => workspace.tags)
  ]
  const byKey = new Map<string, { name: string; count: number }>()
  for (const tags of tagLists) {
    for (const name of tags ?? []) {
      const entry = byKey.get(workspaceTagKey(name))
      if (entry) {
        entry.count += 1
      } else {
        byKey.set(workspaceTagKey(name), { name, count: 1 })
      }
    }
  }
  ensureWorkspaceTagColors(
    store,
    [...byKey.values()].map((entry) => entry.name)
  )
  const colors = store.getUI?.().worktreeTagColors ?? {}
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => {
      const color = colors[key]
      return color ? { ...entry, color } : entry
    })
}

export function setRuntimeWorkspaceTagColor(
  store: RuntimeStore,
  tag: string,
  color: WorkspaceTagColorId
): { tag: string; color: WorkspaceTagColorId } {
  const name = normalizeWorkspaceTag(tag)
  if (!name || !store.updateUI) {
    throw new Error(name ? 'runtime_unavailable' : 'invalid_tag')
  }
  store.updateUI({ worktreeTagColors: { [workspaceTagKey(name)]: color } })
  return { tag: name, color }
}
