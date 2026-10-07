import React, { useCallback, useMemo, useState } from 'react'
import { Tag } from 'lucide-react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../shared/worktree/types'
import { workspaceTagKey } from '../../../../shared/worktree/worktree-tags'
import { WorkspaceTagDot } from './WorkspaceTagChip'
import {
  getWorkspaceTagColorId,
  getWorkspaceTagColorOption,
  getWorkspaceTagColorOptions
} from './workspace-tag-colors'
import { useWorkspaceTagCatalog } from './workspace-tag-catalog'
import { resolveWorkspaceTagSubmit, toggleWorkspaceTag } from './worktree-tag-menu-logic'

const EMPTY_TAGS: readonly string[] = []

/** "Tags ›" submenu of the workspace context menu, modeled on WorktreeStatusMenuItems. */
export function WorktreeTagMenuItems(props: {
  worktree: Worktree
  deletingContext: boolean
}): React.JSX.Element {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={props.deletingContext}>
        <Tag className="size-3.5" />
        {translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.tags', 'Tags')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        <WorktreeTagMenuPanel worktree={props.worktree} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function WorktreeTagMenuPanel({ worktree }: { worktree: Worktree }): React.JSX.Element {
  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const setWorkspaceTagColor = useAppStore((s) => s.setWorkspaceTagColor)
  const colors = useAppStore((s) => s.worktreeTagColors)
  const catalog = useWorkspaceTagCatalog()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recoloringKey, setRecoloringKey] = useState<string | null>(null)
  const currentTags = worktree.tags ?? EMPTY_TAGS

  const applyTags = useCallback(
    (tags: string[]) => {
      void updateWorktreeMeta(
        worktree.id,
        { tags },
        { executionHostId: worktree.hostId ?? 'local' }
      )
    },
    [updateWorktreeMeta, worktree.hostId, worktree.id]
  )

  const needle = query.trim().toLowerCase()
  const visibleTags = useMemo(
    () => catalog.tags.filter((tag) => tag.key.includes(needle)),
    [catalog.tags, needle]
  )
  const canCreate =
    needle !== '' &&
    !catalog.tags.some((tag) => tag.key === needle) &&
    !currentTags.some((tag) => workspaceTagKey(tag) === needle)

  const submit = useCallback(() => {
    const result = resolveWorkspaceTagSubmit(
      query,
      currentTags,
      catalog.tags.map((tag) => tag.name)
    )
    if (result.kind === 'error') {
      setError(result.error)
      return
    }
    setError(null)
    if (result.kind === 'set') {
      applyTags(result.tags)
    }
    setQuery('')
  }, [applyTags, catalog.tags, currentTags, query])

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        submit()
        return
      }
      // Why: the input lives inside a Radix menu; text keys must stay in the field instead of
      // triggering menu typeahead. Arrow up/down and Escape keep navigating/closing the menu.
      if (event.key === 'ArrowLeft') {
        const { selectionStart, selectionEnd } = event.currentTarget
        if (!(selectionStart === 0 && selectionEnd === 0)) {
          event.stopPropagation()
        }
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Escape') {
        event.stopPropagation()
      }
    },
    [submit]
  )

  return (
    <>
      <div className="px-1.5 pb-1">
        <Input
          // Why: autoFocus loses to the menu's focus scope during commit; the shared panels focus a frame later.
          ref={(node) => {
            if (node) {
              requestAnimationFrame(() => node.focus())
            }
          }}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setError(null)
          }}
          onKeyDown={handleInputKeyDown}
          aria-invalid={error ? true : undefined}
          placeholder={translate(
            'auto.components.sidebar.WorktreeTagMenuItems.searchOrCreate',
            'Search or create tag...'
          )}
          variant="menu"
        />
        {error ? (
          <p className="px-0.5 pt-1 text-[11px] leading-snug text-destructive">{error}</p>
        ) : null}
      </div>
      {canCreate && (
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <span className="min-w-0 truncate">
            {translate(
              'auto.components.sidebar.WorktreeTagMenuItems.createTag',
              'Create "{{value0}}"',
              {
                value0: query.trim()
              }
            )}
          </span>
        </DropdownMenuItem>
      )}
      <div className="scrollbar-sleek max-h-56 overflow-y-auto">
        {visibleTags.map((tag) => {
          const colorId = getWorkspaceTagColorId(colors, tag.name)
          const checked = currentTags.some((entry) => workspaceTagKey(entry) === tag.key)
          return (
            <div key={tag.key}>
              <div className="flex items-center">
                <DropdownMenuCheckboxItem
                  checked={checked}
                  className="min-w-0 flex-1"
                  // Why: keep the menu open so several tags can be toggled in one visit.
                  onSelect={(event) => {
                    event.preventDefault()
                    applyTags(toggleWorkspaceTag(currentTags, tag.name))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                      event.stopPropagation()
                      setRecoloringKey(recoloringKey === tag.key ? null : tag.key)
                    }
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                </DropdownMenuCheckboxItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={translate(
                        'auto.components.sidebar.WorktreeTagMenuItems.changeColor',
                        'Change {{value0}} color',
                        { value0: tag.name }
                      )}
                      className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => setRecoloringKey(recoloringKey === tag.key ? null : tag.key)}
                    >
                      <WorkspaceTagDot colorId={colorId} className="size-2.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4}>
                    {getWorkspaceTagColorOption(colorId).label}
                  </TooltipContent>
                </Tooltip>
              </div>
              {recoloringKey === tag.key && (
                <div className="flex items-center gap-1 px-2 pb-1 pl-7">
                  {getWorkspaceTagColorOptions().map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={translate(
                        'auto.components.sidebar.WorktreeTagMenuItems.setColor',
                        'Set {{value0}} color to {{value1}}',
                        { value0: tag.name, value1: color.label }
                      )}
                      className={cn(
                        'flex size-5 items-center justify-center rounded-md border border-transparent outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring',
                        colorId === color.id && 'border-ring bg-accent'
                      )}
                      onClick={() => {
                        setWorkspaceTagColor(tag.name, color.id)
                        setRecoloringKey(null)
                      }}
                    >
                      <span className={cn('size-3 rounded-full', color.swatch)} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
