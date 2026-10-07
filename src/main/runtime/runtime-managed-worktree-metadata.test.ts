import { describe, expect, it, vi } from 'vitest'
import type { Worktree } from '../../shared/worktree/types'
import { updateRuntimeManagedWorktreeMetadata } from './runtime-managed-worktree-metadata'
import type { ResolvedWorktree } from './runtime-worktree-path-identity'
import type { RuntimeStore } from './runtime-store-contract'

describe('updateRuntimeManagedWorktreeMetadata', () => {
  it('writes metadata through the resolved worktree execution host', async () => {
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      hostId: 'ssh:build-box',
      path: '/workspace/app',
      instanceId: 'instance-1'
    } as unknown as ResolvedWorktree
    const setWorktreeMeta = vi.fn()
    const setWorktreeMetaForHost = vi.fn()
    const store = { setWorktreeMeta, setWorktreeMetaForHost } as unknown as RuntimeStore
    const ports = {
      resolveWorktree: vi.fn(async () => worktree),
      validateParent: vi.fn(),
      invalidateResolved: vi.fn(),
      invalidateScan: vi.fn(),
      notifyChanged: vi.fn(),
      showWorktree: vi.fn(async () => worktree as unknown as Worktree)
    }

    await updateRuntimeManagedWorktreeMetadata({
      selector: `id:${worktree.id}`,
      updates: { comment: 'remote row only' },
      store,
      ports
    })

    expect(setWorktreeMetaForHost).toHaveBeenCalledWith(worktree.id, 'ssh:build-box', {
      comment: 'remote row only'
    })
    expect(setWorktreeMeta).not.toHaveBeenCalled()
  })
})

describe('updateRuntimeManagedWorktreeMetadata tags', () => {
  const worktree = {
    id: 'repo-1::/workspace/app',
    repoId: 'repo-1',
    path: '/workspace/app',
    instanceId: 'instance-1'
  } as unknown as ResolvedWorktree

  function setup(initialTags?: string[]) {
    const meta: { tags?: string[] } = initialTags ? { tags: initialTags } : {}
    let ui: { worktreeTagColors?: Record<string, string> } = {}
    const store = {
      getWorktreeMeta: () => meta,
      setWorktreeMeta: vi.fn((_id: string, updates: { tags?: string[] }) => {
        if (updates.tags !== undefined) {
          if (updates.tags.length > 0) {
            meta.tags = updates.tags
          } else {
            delete meta.tags
          }
        }
        return meta
      }),
      getUI: () => ui,
      updateUI: vi.fn((updates: { worktreeTagColors?: Record<string, string> }) => {
        ui = { worktreeTagColors: { ...ui.worktreeTagColors, ...updates.worktreeTagColors } }
      })
    }
    const ports = {
      resolveWorktree: vi.fn(async () => worktree),
      validateParent: vi.fn(),
      invalidateResolved: vi.fn(),
      invalidateScan: vi.fn(),
      notifyChanged: vi.fn(),
      showWorktree: vi.fn(async () => worktree as unknown as Worktree)
    }
    const run = (
      updates: Parameters<typeof updateRuntimeManagedWorktreeMetadata>[0]['updates'],
      selector = `id:${worktree.id}`
    ) =>
      updateRuntimeManagedWorktreeMetadata({
        selector,
        updates,
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fake of the store members the updater reads.
        store: store as unknown as RuntimeStore,
        ports
      })
    return { meta, store, run, getUi: () => ui }
  }

  it('adds and removes against the current host value, case-insensitively', async () => {
    const { meta, run } = setup(['Api'])
    await run({ addTags: ['api', 'web'] })
    expect(meta.tags).toEqual(['Api', 'web'])
    await run({ removeTags: ['API'] })
    expect(meta.tags).toEqual(['web'])
  })

  it('replaces with tags and stores the empty set as absent for null', async () => {
    const { meta, store, run } = setup(['old'])
    await run({ tags: ['a', 'A', 'b'] })
    expect(meta.tags).toEqual(['a', 'b'])
    await run({ tags: null })
    expect(meta.tags).toBeUndefined()
    expect(store.setWorktreeMeta).toHaveBeenLastCalledWith(worktree.id, { tags: [] })
  })

  it('applies replace, then add, then remove in one update', async () => {
    const { meta, run } = setup(['old'])
    await run({ tags: ['a', 'b'], addTags: ['c'], removeTags: ['a'] })
    expect(meta.tags).toEqual(['b', 'c'])
  })

  it('assigns a color to each new tag once and never changes an existing one', async () => {
    const { store, run, getUi } = setup()
    await run({ addTags: ['api'] })
    const first = getUi().worktreeTagColors?.api
    expect(first).toBeDefined()
    await run({ addTags: ['API', 'web'] })
    expect(getUi().worktreeTagColors?.api).toBe(first)
    expect(Object.keys(getUi().worktreeTagColors ?? {}).sort()).toEqual(['api', 'web'])
    await run({ tags: null })
    expect(Object.keys(getUi().worktreeTagColors ?? {}).sort()).toEqual(['api', 'web'])
    expect(store.updateUI).toHaveBeenCalledTimes(2)
  })

  it('refuses tag updates on entity folder workspaces with a clear message', async () => {
    const { run } = setup()
    await expect(run({ addTags: ['api'] }, 'folder:abc')).rejects.toThrow('folder workspaces')
    await expect(run({ tags: null }, 'id:folder:abc')).rejects.toThrow('folder workspaces')
  })

  it('does not touch tags or colors for unrelated updates', async () => {
    const { store, run } = setup(['api'])
    await run({ comment: 'hi' })
    expect(store.setWorktreeMeta).toHaveBeenCalledWith(worktree.id, { comment: 'hi' })
    expect(store.updateUI).not.toHaveBeenCalled()
  })
})
