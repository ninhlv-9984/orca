// @vitest-environment happy-dom

/**
 * The Tags submenu of the workspace context menu: toggle, search-or-create and
 * recolor, driven through a real Radix submenu so the focus and typeahead
 * behavior of the embedded input is part of the assertion.
 */

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
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Worktree } from '../../../../shared/worktree/types'
import { WorktreeTagMenuItems } from './WorktreeTagMenuItems'

function makeWorktree(id: string, tags?: string[]): Worktree {
  return {
    id,
    repoId: 'repo1',
    path: `/tmp/${id}`,
    head: 'abc',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: false,
    displayName: id,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...(tags ? { tags } : {})
  }
}

const target = makeWorktree('wt-target', ['API'])
const other = makeWorktree('wt-other', ['web'])

let container: HTMLDivElement
let root: Root
let updateWorktreeMeta: ReturnType<typeof vi.fn>
let setWorkspaceTagColor: ReturnType<typeof vi.fn>

function render(worktree: Worktree = target): void {
  updateWorktreeMeta = vi.fn().mockResolvedValue({ ok: true })
  setWorkspaceTagColor = vi.fn()
  mocks.state = {
    worktreesByRepo: { repo1: [worktree, other] },
    folderWorkspaces: [],
    filterTags: [],
    worktreeTagColors: { api: 'rose', web: 'blue' },
    updateWorktreeMeta,
    setWorkspaceTagColor
  }
  act(() => {
    root.render(
      <TooltipProvider>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <WorktreeTagMenuItems worktree={worktree} deletingContext={false} />
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
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

function input(): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>('[data-slot="input"]')
  if (!el) {
    throw new Error('input not rendered')
  }
  return el
}

function type(value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input(), value)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function pressEnter(): void {
  act(() => {
    input().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  })
}

function byLabel(label: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`button[aria-label="${label}"]`)
  if (!el) {
    throw new Error(`no button ${label}`)
  }
  return el
}

function checkbox(name: string): HTMLElement {
  const el = [
    ...document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-checkbox-item"]')
  ].find((item) => item.textContent === name)
  if (!el) {
    throw new Error(`no tag row ${name}`)
  }
  return el
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    el.click()
  })
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

describe('WorktreeTagMenuItems', () => {
  it('lists every tag and checks the ones this workspace carries', async () => {
    render()
    openSubmenu()
    await settle()

    expect(checkbox('API').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('web').getAttribute('aria-checked')).toBe('false')
  })

  it('toggles a tag on this workspace through the shared meta path', async () => {
    render()
    openSubmenu()
    await settle()

    click(checkbox('web'))
    expect(updateWorktreeMeta).toHaveBeenLastCalledWith(
      'wt-target',
      { tags: ['API', 'web'] },
      { executionHostId: 'local' }
    )

    click(checkbox('API'))
    expect(updateWorktreeMeta).toHaveBeenLastCalledWith(
      'wt-target',
      { tags: [] },
      { executionHostId: 'local' }
    )
  })

  it('creates and applies a typed tag on Enter, keeping existing ones', async () => {
    render()
    openSubmenu()
    await settle()

    type('Fresh')
    pressEnter()

    expect(updateWorktreeMeta).toHaveBeenCalledWith(
      'wt-target',
      { tags: ['API', 'Fresh'] },
      { executionHostId: 'local' }
    )
    expect(input().value).toBe('')
  })

  it('shows the shared validator error and writes nothing for an invalid tag', async () => {
    render()
    openSubmenu()
    await settle()

    type('a,b')
    pressEnter()

    expect(updateWorktreeMeta).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('must not contain commas')
  })

  it('keeps typed keys inside the input instead of menu typeahead', async () => {
    render()
    openSubmenu()
    await settle()

    const typed = new KeyboardEvent('keydown', { key: 'w', bubbles: true })
    act(() => {
      input().dispatchEvent(typed)
    })

    // Why: React stops propagation at its root, so the Radix menu's own handlers never see the key.
    expect(typed.cancelBubble).toBe(true)
    expect(document.activeElement).toBe(input())
  })

  it('recolors a tag from the swatches next to its dot', async () => {
    render()
    openSubmenu()
    await settle()

    click(byLabel('Change web color'))
    click(byLabel('Set web color to Violet'))

    expect(setWorkspaceTagColor).toHaveBeenCalledWith('web', 'violet')
  })

  it('filters the list by the typed text', async () => {
    render()
    openSubmenu()
    await settle()

    type('we')

    expect(document.body.textContent).toContain('web')
    expect(
      [...document.querySelectorAll('[data-slot="dropdown-menu-checkbox-item"]')].map(
        (item) => item.textContent
      )
    ).toEqual(['web'])
  })
})
