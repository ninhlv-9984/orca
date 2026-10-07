import { describe, expect, it } from 'vitest'
import type { RuntimeStore } from './runtime-store-contract'
import { listRuntimeWorkspaceTags, setRuntimeWorkspaceTagColor } from './runtime-workspace-tags'

function makeStore(colors: Record<string, string> = {}) {
  let ui = { worktreeTagColors: colors }
  const store = {
    getAllWorktreeMeta: () => ({
      a: { tags: ['Zeta', 'api'] },
      b: { tags: ['API'] },
      c: {}
    }),
    getFolderWorkspaces: () => [{ tags: ['alpha', 'zeta'] }, {}],
    getUI: () => ui,
    updateUI: (updates: { worktreeTagColors?: Record<string, string> }) => {
      ui = { worktreeTagColors: { ...ui.worktreeTagColors, ...updates.worktreeTagColors } }
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fake of the store members read here.
  return store as unknown as RuntimeStore
}

describe('listRuntimeWorkspaceTags', () => {
  it('counts carriers case-insensitively, keeps first-seen casing and sorts by name', () => {
    const tags = listRuntimeWorkspaceTags(makeStore({ api: 'rose' }))
    expect(tags.map(({ name, count }) => [name, count])).toEqual([
      ['alpha', 1],
      ['api', 2],
      ['Zeta', 2]
    ])
    expect(tags.find((tag) => tag.name === 'api')?.color).toBe('rose')
  })

  it('colors tags that have no color yet', () => {
    const tags = listRuntimeWorkspaceTags(makeStore())
    expect(tags).toHaveLength(3)
    expect(tags.every((tag) => typeof tag.color === 'string')).toBe(true)
  })
})

describe('setRuntimeWorkspaceTagColor', () => {
  it('stores the color under the lowercase name', () => {
    const store = makeStore()
    expect(setRuntimeWorkspaceTagColor(store, ' Api ', 'violet')).toEqual({
      tag: 'Api',
      color: 'violet'
    })
    expect(store.getUI?.().worktreeTagColors).toEqual({ api: 'violet' })
  })

  it('rejects an invalid tag', () => {
    expect(() => setRuntimeWorkspaceTagColor(makeStore(), 'a,b', 'blue')).toThrow('invalid_tag')
  })
})
