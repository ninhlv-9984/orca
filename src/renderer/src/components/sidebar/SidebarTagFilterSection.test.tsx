// @vitest-environment happy-dom

/** The Tags filter panel of the Workspace options popover, mirroring the Projects panel. */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return { state }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import SidebarTagFilterSection from './SidebarTagFilterSection'

const worktrees = [{ id: 'a', tags: ['API', 'web'] }, { id: 'b', tags: ['api'] }, { id: 'c' }]

let container: HTMLDivElement
let root: Root
let setFilterTags: ReturnType<typeof vi.fn>

function render(overrides: Record<string, unknown> = {}): void {
  setFilterTags = vi.fn()
  mocks.state = {
    worktreesByRepo: { r: worktrees },
    folderWorkspaces: [{ id: 'f', tags: ['web'] }],
    filterTags: [],
    worktreeTagColors: { api: 'rose' },
    setFilterTags,
    ...overrides
  }
  act(() => {
    root.render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <SidebarTagFilterSection />
        </DropdownMenuContent>
      </DropdownMenu>
    )
  })
}

function openSubmenu(): void {
  const trigger = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-trigger"]')
  if (!trigger) {
    throw new Error('sub-trigger not rendered')
  }
  act(() => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    trigger.click()
  })
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
  })
}

function rows(): string[] {
  return [...document.querySelectorAll('[data-slot="command-item"]')].map(
    (item) => item.textContent ?? ''
  )
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  )
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SidebarTagFilterSection', () => {
  it('lists each tag once with its workspace count, folder workspaces included', async () => {
    render()
    openSubmenu()
    await settle()

    expect(rows()).toEqual(['API2', 'web2'])
  })

  it('selects a tag with its first-seen casing', async () => {
    render()
    openSubmenu()
    await settle()

    act(() => {
      document.querySelectorAll<HTMLElement>('[data-slot="command-item"]')[1].click()
    })

    expect(setFilterTags).toHaveBeenCalledWith(['web'])
  })

  it('shows selected tags as removable chips and hides them from the list', async () => {
    render({ filterTags: ['web'] })
    openSubmenu()
    await settle()

    expect(rows()).toEqual(['API2'])
    act(() => {
      document.querySelector<HTMLElement>('[data-workspace-tag-chip="web"] button')?.click()
    })
    expect(setFilterTags).toHaveBeenCalledWith([])
  })

  it('hides the row when no workspace carries a tag and nothing is selected', () => {
    render({ worktreesByRepo: { r: [{ id: 'c' }] }, folderWorkspaces: [] })

    expect(document.querySelector('[data-slot="dropdown-menu-sub-trigger"]')).toBeNull()
  })
})
