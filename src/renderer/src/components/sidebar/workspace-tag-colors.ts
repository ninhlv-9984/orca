import {
  WORKSPACE_TAG_COLOR_IDS,
  workspaceTagKey,
  type WorkspaceTagColorId,
  type WorkspaceTagColors
} from '../../../../shared/worktree/worktree-tags'
import { getWorkspaceStatusColorOptions } from './workspace-status'

/** Tag colors are workspace-status color ids, so they render with the status palette's classes. */
export function getWorkspaceTagColorOption(colorId: string | undefined): {
  id: string
  label: string
  tone: string
  swatch: string
} {
  const options = getWorkspaceStatusColorOptions()
  return options.find((option) => option.id === colorId) ?? options[0]
}

export function getWorkspaceTagColorOptions(): (ReturnType<typeof getWorkspaceTagColorOption> & {
  id: WorkspaceTagColorId
})[] {
  return WORKSPACE_TAG_COLOR_IDS.map((id) => ({ ...getWorkspaceTagColorOption(id), id }))
}

export function getWorkspaceTagColorId(
  colors: WorkspaceTagColors,
  tag: string
): WorkspaceTagColorId | undefined {
  return colors[workspaceTagKey(tag)]
}
