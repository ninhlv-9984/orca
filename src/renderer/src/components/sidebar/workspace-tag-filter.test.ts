import { describe, expect, it } from 'vitest'
import {
  computeClearFilterActions,
  computeVisibleWorktreeIds,
  sidebarHasActiveFilters
} from './visible-worktrees'
import { filterFolderWorkspacesByTags, pruneVanishedFilterTags } from './workspace-tag-filter'
import { collectWorkspaceTagCatalog } from './workspace-tag-catalog'
import { resolveWorkspaceTagSubmit, toggleWorkspaceTag } from './worktree-tag-menu-logic'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

function makeWorktree(id: string, overrides: Partial<Worktree> = {}): Worktree {
  return {
    id,
    repoId: 'repo1',
    path: `/tmp/${id}`,
    head: 'abc123',
    branch: 'refs/heads/feature',
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
    ...overrides
  }
}

const repoMap = new Map<string, Repo>([
  ['repo1', { id: 'repo1', path: '/repo1', displayName: 'Repo 1', badgeColor: '#000', addedAt: 0 }]
])

function options(filterTags: readonly string[]): Parameters<typeof computeVisibleWorktreeIds>[2] {
  return {
    filterRepoIds: [],
    filterTags,
    showSleepingWorkspaces: true,
    tabsByWorktree: null,
    ptyIdsByTabId: null,
    browserTabsByWorktree: null,
    worktreeIdsWithLiveAgent: new Set<string>(),
    hideDefaultBranchWorkspace: false,
    hideAutomationGeneratedWorkspaces: false,
    hideCliCreatedWorkspaces: false,
    hideDetachedHeadWorkspaces: false,
    hideWorkspacesFromOtherDevices: false,
    pairedDeviceIdsByEnvironment: new Map<string, string>(),
    repoMap,
    workspaceHostScope: 'all',
    defaultHostId: LOCAL_EXECUTION_HOST_ID,
    worktreeLineageById: {}
  }
}

const worktrees = [
  makeWorktree('api', { tags: ['API'] }),
  makeWorktree('web', { tags: ['Web', 'ui'] }),
  makeWorktree('pinned-untagged', { isPinned: true }),
  makeWorktree('pinned-api', { isPinned: true, tags: ['api'] }),
  makeWorktree('none')
]
const sortedIds = worktrees.map((worktree) => worktree.id)

describe('tag filter in computeVisibleWorktreeIds', () => {
  it('shows every workspace when the filter is empty', () => {
    expect(computeVisibleWorktreeIds({ repo1: worktrees }, sortedIds, options([]))).toEqual(
      sortedIds
    )
  })

  it('matches case-insensitively with OR semantics', () => {
    expect(
      computeVisibleWorktreeIds({ repo1: worktrees }, sortedIds, options(['api', 'WEB']))
    ).toEqual(['api', 'web', 'pinned-api'])
  })

  it('does not exempt pinned workspaces', () => {
    const ids = computeVisibleWorktreeIds({ repo1: worktrees }, sortedIds, options(['ui']))
    expect(ids).toEqual(['web'])
    expect(ids).not.toContain('pinned-untagged')
  })

  it('yields nothing for a tag no workspace carries', () => {
    expect(computeVisibleWorktreeIds({ repo1: worktrees }, sortedIds, options(['ghost']))).toEqual(
      []
    )
  })
})

describe('tag filter chrome', () => {
  const base = {
    showSleepingWorkspaces: true,
    filterRepoIds: [],
    hideDefaultBranchWorkspace: false,
    hideAutomationGeneratedWorkspaces: false,
    hideCliCreatedWorkspaces: false,
    hideDetachedHeadWorkspaces: false,
    hideWorkspacesFromOtherDevices: false,
    alwaysShowDefaultBranchWorkspace: true,
    workspaceHostScope: 'all' as const
  }

  it('counts an active tag filter and offers to clear it', () => {
    expect(sidebarHasActiveFilters({ ...base, filterTags: [] })).toBe(false)
    expect(sidebarHasActiveFilters({ ...base, filterTags: ['api'] })).toBe(true)
    expect(computeClearFilterActions({ ...base, filterTags: ['api'] }).resetFilterTags).toBe(true)
    expect(computeClearFilterActions({ ...base, filterTags: [] }).resetFilterTags).toBe(false)
  })
})

describe('filterFolderWorkspacesByTags', () => {
  const folder = (id: string, tags?: string[]): FolderWorkspace => ({
    id,
    projectGroupId: 'group',
    name: id,
    folderPath: `/tmp/${id}`,
    connectionId: null,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 1,
    updatedAt: 1,
    ...(tags ? { tags } : {})
  })

  it('keeps folder workspaces carrying any selected tag', () => {
    const all = [folder('a', ['Api']), folder('b'), folder('c', ['web'])]
    expect(filterFolderWorkspacesByTags(all, ['api']).map((entry) => entry.id)).toEqual(['a'])
    expect(filterFolderWorkspacesByTags(all, [])).toBe(all)
  })
})

describe('pruneVanishedFilterTags', () => {
  it('drops tags that were known and have disappeared', () => {
    expect(
      pruneVanishedFilterTags(['Api', 'web'], new Set(['api', 'web']), new Set(['web']))
    ).toEqual(['web'])
  })

  it('keeps tags it has never seen, so a persisted filter survives startup', () => {
    const filter = ['api']
    expect(pruneVanishedFilterTags(filter, new Set(), new Set())).toBe(filter)
  })
})

describe('collectWorkspaceTagCatalog', () => {
  it('merges casing, counts workspaces, skips archived and counts the filter match', () => {
    const catalog = collectWorkspaceTagCatalog(
      [
        makeWorktree('a', { tags: ['API', 'web'] }),
        makeWorktree('b', { tags: ['api'] }),
        makeWorktree('c', { isArchived: true, tags: ['api'] })
      ],
      [{ tags: ['Web'] }, {}],
      ['web']
    )
    expect(catalog.tags).toEqual([
      { name: 'API', key: 'api', count: 2 },
      { name: 'web', key: 'web', count: 2 }
    ])
    expect(catalog.totalWorkspaces).toBe(4)
    expect(catalog.matchingWorkspaces).toBe(2)
  })
})

describe('tags submenu logic', () => {
  it('creates a new tag and applies it', () => {
    expect(resolveWorkspaceTagSubmit(' New ', ['a'], ['a'])).toEqual({
      kind: 'set',
      tags: ['a', 'New']
    })
  })

  it('reuses the first-seen casing of an existing tag', () => {
    expect(resolveWorkspaceTagSubmit('api', undefined, ['API'])).toEqual({
      kind: 'set',
      tags: ['API']
    })
  })

  it('does nothing for a tag the workspace already has', () => {
    expect(resolveWorkspaceTagSubmit('API', ['api'], ['api'])).toEqual({ kind: 'noop' })
  })

  it('surfaces shared validator errors', () => {
    expect(resolveWorkspaceTagSubmit('a,b', [], [])).toMatchObject({ kind: 'error' })
    expect(resolveWorkspaceTagSubmit('x'.repeat(33), [], [])).toMatchObject({ kind: 'error' })
    expect(resolveWorkspaceTagSubmit('   ', [], [])).toEqual({ kind: 'noop' })
  })

  it('toggles a tag on and off case-insensitively', () => {
    expect(toggleWorkspaceTag(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleWorkspaceTag(['a', 'b'], 'A')).toEqual(['b'])
    expect(toggleWorkspaceTag(['a'], 'a')).toEqual([])
  })
})
