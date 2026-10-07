// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const state: Record<string, unknown> = {}
  return {
    state,
    listeners,
    setState(next: Record<string, unknown>): void {
      mocks.state = next
      listeners.forEach((listener) => listener())
    }
  }
})

vi.mock('@/store', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
      useSyncExternalStore(
        (listener) => {
          mocks.listeners.add(listener)
          return () => mocks.listeners.delete(listener)
        },
        () => selector(mocks.state)
      )
  }
})

import { WorkspaceTagFilterStrip } from './WorkspaceTagFilterStrip'

let container: HTMLDivElement
let root: Root
let setFilterTags: ReturnType<typeof vi.fn>

function render(overrides: Record<string, unknown> = {}): void {
  setFilterTags = vi.fn()
  mocks.state = {
    worktreesByRepo: {
      r: [{ id: 'a', tags: ['API'] }, { id: 'b', tags: ['web'] }, { id: 'c' }]
    },
    folderWorkspaces: [],
    filterTags: ['api'],
    worktreeTagColors: { api: 'rose' },
    setFilterTags,
    ...overrides
  }
  act(() => {
    root.render(<WorkspaceTagFilterStrip />)
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
  vi.restoreAllMocks()
})

describe('WorkspaceTagFilterStrip', () => {
  it('is hidden while no tag filter is active', () => {
    render({ filterTags: [] })
    expect(container.querySelector('[data-workspace-tag-filter-strip]')).toBeNull()
  })

  it('shows active tags as chips with a matching/total count', () => {
    render()
    expect(container.querySelector('[data-workspace-tag-chip="api"]')).not.toBeNull()
    expect(container.textContent).toContain('1/3')
  })

  it('removes only the clicked tag from the filter', () => {
    render({ filterTags: ['api', 'web'] })
    act(() => {
      container.querySelector<HTMLElement>('[data-workspace-tag-chip="api"] button')?.click()
    })
    expect(setFilterTags).toHaveBeenCalledWith(['web'])
  })

  it('keeps a selected tag no workspace carries, shown muted and removable', () => {
    render({ filterTags: ['api', 'ghost'] })

    expect(setFilterTags).not.toHaveBeenCalled()
    const ghost = container.querySelector('[data-workspace-tag-chip="ghost"]')
    expect(ghost?.querySelector('.opacity-50')).not.toBeNull()
    expect(container.querySelector('[data-workspace-tag-chip="api"] .opacity-50')).toBeNull()
    act(() => {
      ghost?.querySelector('button')?.click()
    })
    expect(setFilterTags).toHaveBeenCalledWith(['api'])
  })

  it('does not drop a persisted tag when workspaces transiently leave the store', () => {
    render({ filterTags: ['api'] })
    act(() => {
      mocks.setState({ ...mocks.state, worktreesByRepo: {} })
    })

    expect(setFilterTags).not.toHaveBeenCalled()
    expect(container.querySelector('[data-workspace-tag-chip="api"]')).not.toBeNull()
  })
})
