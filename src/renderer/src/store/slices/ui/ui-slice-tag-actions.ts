import type { UISlice, UISliceSet } from './ui-slice-contract'
import {
  normalizeWorkspaceTagList,
  workspaceTagKey
} from '../../../../../shared/worktree/worktree-tags'

/** Workspace tag filter (debounced writer owns it) and main-owned tag colors (written explicitly). */
export function createWorkspaceTagActions(
  set: UISliceSet
): Pick<UISlice, 'filterTags' | 'setFilterTags' | 'worktreeTagColors' | 'setWorkspaceTagColor'> {
  return {
    filterTags: [],
    setFilterTags: (tags) => set({ filterTags: normalizeWorkspaceTagList(tags) }),
    worktreeTagColors: {},
    setWorkspaceTagColor: (tag, color) => {
      const key = workspaceTagKey(tag.trim())
      set((s) => ({ worktreeTagColors: { ...s.worktreeTagColors, [key]: color } }))
      // Why: colors are main-owned (CLI agents assign them too), so write through ui.set, which merges,
      // instead of the debounced writer whose baseline would treat this client as the owner.
      window.api.ui.set({ worktreeTagColors: { [key]: color } }).catch(console.error)
    }
  }
}
