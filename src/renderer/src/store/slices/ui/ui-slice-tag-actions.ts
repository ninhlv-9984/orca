import type { UISlice, UISliceSet } from './ui-slice-contract'
import {
  normalizeWorkspaceTagList,
  workspaceTagKey,
  type WorkspaceTagColorId
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
      let previous: WorkspaceTagColorId | undefined
      set((s) => {
        previous = s.worktreeTagColors[key]
        return { worktreeTagColors: { ...s.worktreeTagColors, [key]: color } }
      })
      // Why: colors are main-owned (CLI agents assign them too), so write through ui.set, which merges,
      // instead of the debounced writer whose baseline would treat this client as the owner.
      window.api.ui.set({ worktreeTagColors: { [key]: color } }).catch((error) => {
        console.error(error)
        // Why: roll back the optimistic color so the UI does not show one main never stored.
        set((s) => {
          if (s.worktreeTagColors[key] !== color) {
            return s
          }
          const { [key]: _failed, ...rest } = s.worktreeTagColors
          return { worktreeTagColors: previous ? { ...rest, [key]: previous } : rest }
        })
      })
    }
  }
}
