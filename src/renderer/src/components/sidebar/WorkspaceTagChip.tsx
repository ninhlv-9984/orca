import React from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { getWorkspaceTagColorOption } from './workspace-tag-colors'

export function WorkspaceTagDot({
  colorId,
  className
}: {
  colorId: string | undefined
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        getWorkspaceTagColorOption(colorId).swatch,
        className
      )}
    />
  )
}

/** Tag chip for cards and the filter strip; sized like the host context badge, optionally removable. */
export function WorkspaceTagChip({
  tag,
  colorId,
  onRemove
}: {
  tag: string
  colorId: string | undefined
  onRemove?: () => void
}): React.JSX.Element {
  const color = getWorkspaceTagColorOption(colorId)
  return (
    <Badge variant="hostContext" className="max-w-[8rem] min-w-0" data-workspace-tag-chip={tag}>
      {/* Why a wrapper: the tone class comes from the status palette at runtime, which a primitive's static className cannot carry. */}
      <span className={cn('flex min-w-0 items-center gap-1', color.tone)}>
        <WorkspaceTagDot colorId={colorId} />
        <span className="min-w-0 truncate">{tag}</span>
        {onRemove ? (
          <button
            type="button"
            aria-label={translate(
              'auto.components.sidebar.SidebarRepositoryFilterSection.f10ca29601',
              'Remove {{value0}} filter',
              { value0: tag }
            )}
            className="-mr-1 flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRemove}
          >
            <X className="size-2.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </span>
    </Badge>
  )
}
