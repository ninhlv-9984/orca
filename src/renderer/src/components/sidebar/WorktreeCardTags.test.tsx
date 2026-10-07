// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = { worktreeTagColors: { api: 'rose' } }
  return { state }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

import { TooltipProvider } from '@/components/ui/tooltip'
import { WorktreeCardTags } from './WorktreeCardTags'

let container: HTMLDivElement
let root: Root

function render(tags: string[]): void {
  act(() => {
    root.render(
      <TooltipProvider>
        <WorktreeCardTags tags={tags} />
      </TooltipProvider>
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('WorktreeCardTags', () => {
  it('renders nothing without tags', () => {
    render([])
    expect(container.querySelector('[data-worktree-card-tags]')).toBeNull()
  })

  it('renders one chip per tag using the tag color', () => {
    render(['api', 'web'])
    expect(container.querySelectorAll('[data-workspace-tag-chip]')).toHaveLength(2)
    expect(
      container.querySelector('[data-workspace-tag-chip="api"] span.bg-rose-500')
    ).not.toBeNull()
  })

  it('caps the chips and summarizes the rest as +N', () => {
    render(['a', 'b', 'c', 'd', 'e'])
    expect(container.querySelectorAll('[data-workspace-tag-chip]')).toHaveLength(3)
    expect(container.textContent).toContain('+2')
  })
})
