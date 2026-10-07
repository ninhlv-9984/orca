import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { WorkspaceTagChip } from './WorkspaceTagChip'
import { getWorkspaceTagColorId } from './workspace-tag-colors'

// Why: cards stay compact; extra tags collapse into a "+N" chip whose tooltip lists them.
export const MAX_WORKTREE_CARD_TAG_CHIPS = 3

/** Colored tag chips on a workspace card (the 'tags' card property). */
export const WorktreeCardTags = React.memo(function WorktreeCardTags({
  tags,
  className
}: {
  tags: readonly string[]
  className?: string
}): React.JSX.Element | null {
  const colors = useAppStore((s) => s.worktreeTagColors)
  if (tags.length === 0) {
    return null
  }
  const shown = tags.slice(0, MAX_WORKTREE_CARD_TAG_CHIPS)
  const hidden = tags.slice(MAX_WORKTREE_CARD_TAG_CHIPS)
  return (
    <div className={className} data-worktree-card-tags="">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {shown.map((tag) => (
          <WorkspaceTagChip key={tag} tag={tag} colorId={getWorkspaceTagColorId(colors, tag)} />
        ))}
        {hidden.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="hostContext" className="shrink-0">
                +{hidden.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              {hidden.join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
})
