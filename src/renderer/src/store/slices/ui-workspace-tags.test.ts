import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistedUIState } from '../../../../shared/persisted-ui-state-types'
import { createUIStore, makePersistedUI } from './ui-slice-test-harness'
import { registerSettingsAndSidebarIpcBridge } from '../../hooks/ipc-events/settings-sidebar-ipc-bridge'
import { useAppStore } from '../index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useAppStore.setState(useAppStore.getInitialState(), true)
})

describe('workspace tag filter state', () => {
  it('normalizes tags written through setFilterTags', () => {
    const store = createUIStore()
    store.getState().setFilterTags([' API ', 'api', 'a,b', 'web'])
    expect(store.getState().filterTags).toEqual(['API', 'web'])
  })

  it('hydrates the persisted tag filter and defaults to none', () => {
    const store = createUIStore()
    expect(store.getState().filterTags).toEqual([])
    store.getState().hydratePersistedUI(makePersistedUI({ filterTags: ['Api', 'api', 'web'] }))
    expect(store.getState().filterTags).toEqual(['Api', 'web'])
    store.getState().hydratePersistedUI(makePersistedUI())
    expect(store.getState().filterTags).toEqual([])
  })

  it('keeps an unflushed local tag filter edit across a sync broadcast', () => {
    const store = createUIStore()
    store.getState().hydratePersistedUI(makePersistedUI({ filterTags: ['api'] }), 'startup')
    store.getState().setFilterTags(['api', 'web'])

    store.getState().hydratePersistedUI(makePersistedUI({ filterTags: ['api'] }), 'sync')

    expect(store.getState().filterTags).toEqual(['api', 'web'])
  })

  it('persists the tag filter through the debounced writer fields', async () => {
    const { persistedUIWriteFieldsToWireUpdate } = await import('./persisted-ui-write-baseline')
    expect(persistedUIWriteFieldsToWireUpdate({ filterTags: ['api'] })).toEqual({
      filterTags: ['api']
    })
  })
})

describe('workspace tag colors', () => {
  it('hydrates main-assigned colors and keeps the same object when unchanged', () => {
    const store = createUIStore()
    store.getState().hydratePersistedUI(makePersistedUI({ worktreeTagColors: { api: 'rose' } }))
    const colors = store.getState().worktreeTagColors
    expect(colors).toEqual({ api: 'rose' })

    store
      .getState()
      .hydratePersistedUI(makePersistedUI({ worktreeTagColors: { api: 'rose' }, uiZoomLevel: 1 }))
    expect(store.getState().worktreeTagColors).toBe(colors)
  })

  it('drops invalid colors from the payload', () => {
    const store = createUIStore()
    store.getState().hydratePersistedUI(
      makePersistedUI({
        // Why: a hand-edited or newer-build file can carry colors outside the tag palette.
        worktreeTagColors: JSON.parse('{"api":"rose","bad":"neutral"}')
      })
    )
    expect(store.getState().worktreeTagColors).toEqual({ api: 'rose' })
  })

  it('recolors through an explicit ui.set of just that tag, never the debounced writer', () => {
    const setUI = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { ui: { set: setUI } } })
    const store = createUIStore()
    store.getState().hydratePersistedUI(makePersistedUI({ worktreeTagColors: { web: 'blue' } }))
    const baseline = store.getState().persistedUIWriteBaseline

    store.getState().setWorkspaceTagColor(' API ', 'violet')

    expect(store.getState().worktreeTagColors).toEqual({ web: 'blue', api: 'violet' })
    expect(setUI).toHaveBeenCalledWith({ worktreeTagColors: { api: 'violet' } })
    expect(store.getState().persistedUIWriteBaseline).toBe(baseline)
  })

  it('shows colors assigned by a CLI agent when ui:stateChanged arrives', () => {
    let onStateChanged: ((ui: PersistedUIState) => void) | undefined
    const noop = (): void => {}
    // Why: the bridge wires many unrelated channels; only ui.onStateChanged matters here.
    const callable = (): unknown =>
      new Proxy(noop, {
        get: (_target, prop) => (prop === 'then' ? undefined : callable()),
        apply: () => Promise.resolve(null)
      })
    const ui = new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === 'onStateChanged'
            ? (callback: (ui: PersistedUIState) => void) => {
                onStateChanged = callback
                return noop
              }
            : callable()
      }
    )
    vi.stubGlobal('window', {
      api: new Proxy({}, { get: (_target, prop) => (prop === 'ui' ? ui : callable()) })
    })
    vi.stubGlobal('navigator', { userAgent: 'Linux' })

    registerSettingsAndSidebarIpcBridge([])
    expect(onStateChanged).toBeDefined()
    onStateChanged?.(makePersistedUI({ worktreeTagColors: { fresh: 'emerald' } }))

    expect(useAppStore.getState().worktreeTagColors).toEqual({ fresh: 'emerald' })
  })
})
