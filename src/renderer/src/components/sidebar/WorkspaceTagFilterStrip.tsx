import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { workspaceTagKey } from '../../../../shared/worktree/worktree-tags'
import { WorkspaceTagChip } from './WorkspaceTagChip'
import { getWorkspaceTagColorId } from './workspace-tag-colors'
import { useWorkspaceTagCatalog } from './workspace-tag-catalog'

/** Thin strip under the sidebar header while a tag filter is active; hidden otherwise. */
export const WorkspaceTagFilterStrip = React.memo(
  function WorkspaceTagFilterStrip(): React.JSX.Element | null {
    useTranslation()
    const filterTags = useAppStore((s) => s.filterTags)
    const setFilterTags = useAppStore((s) => s.setFilterTags)
    const colors = useAppStore((s) => s.worktreeTagColors)
    const catalog = useWorkspaceTagCatalog()
    // Why: never prune on catalog changes (workspaces can transiently leave the store on reload or reconnect);
    // a tag no workspace carries stays selected and is shown muted so the user can remove it.
    const carriedKeys = new Set(catalog.tags.map((tag) => tag.key))

    if (filterTags.length === 0) {
      return null
    }

    return (
      <div
        className="mx-2 mb-1 flex min-w-0 items-start gap-1.5 px-2"
        data-workspace-tag-filter-strip=""
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {filterTags.map((tag) => (
            <WorkspaceTagChip
              key={workspaceTagKey(tag)}
              tag={tag}
              colorId={getWorkspaceTagColorId(colors, tag)}
              muted={catalog.totalWorkspaces > 0 && !carriedKeys.has(workspaceTagKey(tag))}
              onRemove={() => setFilterTags(filterTags.filter((entry) => entry !== tag))}
            />
          ))}
        </div>
        <span
          className="shrink-0 pt-0.5 text-[10px] font-medium tabular-nums leading-4 text-muted-foreground"
          title={translate(
            'auto.components.sidebar.WorkspaceTags.matchingCountTitle',
            'Workspaces with these tags / all workspaces'
          )}
        >
          {catalog.matchingWorkspaces}/{catalog.totalWorkspaces}
        </span>
      </div>
    )
  }
)
