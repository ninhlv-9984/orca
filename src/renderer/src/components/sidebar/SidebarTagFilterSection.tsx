import React, { useCallback, useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { workspaceTagKey } from '../../../../shared/worktree/worktree-tags'
import { SidebarTagFilterPanel } from './SidebarTagFilterPanel'
import { useWorkspaceTagCatalog } from './workspace-tag-catalog'

function getTagFilterVisibilityLabel(filterTags: readonly string[]): string {
  if (filterTags.length === 0) {
    return translate('auto.components.sidebar.SidebarTagFilterSection.allTags', 'All tags')
  }
  if (filterTags.length === 1) {
    return filterTags[0]
  }
  return translate(
    'auto.components.sidebar.SidebarTagFilterSection.selectedTagsCount',
    '{{value0}} tags',
    {
      value0: filterTags.length
    }
  )
}

/** "Tags ›" row of the Workspace options popover; its panel mirrors the Projects filter panel. */
const SidebarTagFilterSection = React.memo(function SidebarTagFilterSection({
  preserveWorkspaceBoardOpen = false
}: {
  preserveWorkspaceBoardOpen?: boolean
}) {
  const filterTags = useAppStore((s) => s.filterTags)
  const setFilterTags = useAppStore((s) => s.setFilterTags)
  const colors = useAppStore((s) => s.worktreeTagColors)
  const catalog = useWorkspaceTagCatalog()
  const hasTagFilter = filterTags.length > 0
  const availableTags = useMemo(() => {
    const selected = new Set(filterTags.map(workspaceTagKey))
    return catalog.tags.filter((tag) => !selected.has(tag.key))
  }, [catalog.tags, filterTags])
  const clearTags = useCallback(() => setFilterTags([]), [setFilterTags])

  // Why: with no tags anywhere (and none selected) the row would open an empty panel.
  if (catalog.tags.length === 0 && !hasTagFilter) {
    return null
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex flex-1 items-center justify-between gap-3">
          <span>
            {translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.tags', 'Tags')}
          </span>
          <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
            {getTagFilterVisibilityLabel(filterTags)}
          </span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-64"
        data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
      >
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.tags', 'Tags')}
            {hasTagFilter && (
              <span className="ml-1.5 font-medium text-foreground">· {filterTags.length}</span>
            )}
          </span>
          <button
            type="button"
            onClick={clearTags}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={!hasTagFilter}
          >
            {translate(
              'auto.components.sidebar.SidebarRepositoryFilterSection.d3a9c4cea1',
              'Clear'
            )}
          </button>
        </div>
        <SidebarTagFilterPanel
          availableTags={availableTags}
          filterTags={filterTags}
          hasTagFilter={hasTagFilter}
          colors={colors}
          setFilterTags={setFilterTags}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
})

export default SidebarTagFilterSection
