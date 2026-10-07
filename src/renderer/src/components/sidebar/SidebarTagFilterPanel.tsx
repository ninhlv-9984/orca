import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { translate } from '@/i18n/i18n'
import { workspaceTagKey, type WorkspaceTagColors } from '../../../../shared/worktree/worktree-tags'
import { keepTextKeysInMenuInput } from './menu-text-input-keydown'
import { WorkspaceTagChip, WorkspaceTagDot } from './WorkspaceTagChip'
import { getWorkspaceTagColorId } from './workspace-tag-colors'
import type { WorkspaceTagEntry } from './workspace-tag-catalog'

function tagCommandFilter(_value: string, search: string, keywords?: string[]): number {
  const query = search.trim().toLowerCase()
  if (!query) {
    return 1
  }
  const index = (keywords?.[0] ?? '').toLowerCase().indexOf(query)
  return index === -1 ? 0 : 1 + 1 / (index + 1)
}

type SidebarTagFilterPanelProps = {
  availableTags: WorkspaceTagEntry[]
  filterTags: readonly string[]
  hasTagFilter: boolean
  colors: WorkspaceTagColors
  setFilterTags: (tags: string[]) => void
}

/**
 * Search + multi-select body of the Tags filter. Mirrors SidebarProjectFilterPanel, including
 * mounting with the submenu so the query resets on reopen.
 */
export function SidebarTagFilterPanel({
  availableTags,
  filterTags,
  hasTagFilter,
  colors,
  setFilterTags
}: SidebarTagFilterPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [highlightedKey, setHighlightedKey] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Why: autoFocus loses to the root menu's focus scope during commit; a frame later the focus sticks.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleSelectTag = useCallback(
    (tag: string) => {
      setFilterTags([...filterTags, tag])
      setQuery('')
    },
    [filterTags, setFilterTags]
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      setFilterTags(filterTags.filter((entry) => workspaceTagKey(entry) !== workspaceTagKey(tag)))
    },
    [filterTags, setFilterTags]
  )

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace' && query === '' && filterTags.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        handleRemoveTag(filterTags.at(-1) ?? '')
        return
      }
      if (event.key === 'Enter') {
        const needle = query.trim().toLowerCase()
        const tag =
          availableTags.find((entry) => entry.key === highlightedKey) ??
          availableTags.find((entry) => entry.key.includes(needle))
        if (tag) {
          event.preventDefault()
          event.stopPropagation()
          handleSelectTag(tag.name)
        }
        return
      }
      keepTextKeysInMenuInput(event)
    },
    [availableTags, filterTags, handleRemoveTag, handleSelectTag, highlightedKey, query]
  )

  return (
    <Command variant="menu" filter={tagCommandFilter} onValueChange={setHighlightedKey}>
      {filterTags.length > 0 && (
        <div className="scrollbar-sleek mx-1 mb-1 flex max-h-16 flex-wrap gap-1 overflow-y-auto rounded-[7px] border border-border/70 bg-muted/25 p-1">
          {filterTags.map((tag) => (
            <WorkspaceTagChip
              key={workspaceTagKey(tag)}
              tag={tag}
              colorId={getWorkspaceTagColorId(colors, tag)}
              onRemove={() => handleRemoveTag(tag)}
            />
          ))}
        </div>
      )}
      <CommandInput
        ref={inputRef}
        placeholder={
          hasTagFilter
            ? translate(
                'auto.components.sidebar.SidebarTagFilterSection.addTagPlaceholder',
                'Add tag...'
              )
            : translate(
                'auto.components.sidebar.SidebarTagFilterSection.filterTagsPlaceholder',
                'Filter tags...'
              )
        }
        value={query}
        onValueChange={setQuery}
        onKeyDown={handleInputKeyDown}
        variant="menu"
      />
      <CommandList variant="menu" className="max-h-48">
        <CommandEmpty variant="menu">
          {hasTagFilter
            ? translate(
                'auto.components.sidebar.SidebarTagFilterSection.noUnselectedTags',
                'No unselected tags match'
              )
            : translate('auto.components.sidebar.SidebarTagFilterSection.noTags', 'No tags match')}
        </CommandEmpty>
        {availableTags.map((tag) => (
          <CommandItem
            key={tag.key}
            value={tag.key}
            keywords={[tag.name]}
            onSelect={() => handleSelectTag(tag.name)}
            variant="menu"
          >
            <WorkspaceTagDot
              colorId={getWorkspaceTagColorId(colors, tag.name)}
              className="size-2"
            />
            <span className="min-w-0 flex-1 truncate">{tag.name}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {tag.count}
            </span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  )
}
