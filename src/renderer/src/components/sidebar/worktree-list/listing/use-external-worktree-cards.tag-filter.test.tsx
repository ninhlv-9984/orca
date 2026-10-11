// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useAppStore } from '@/store'
import type { Repo } from '../../../../../../shared/repo-types'
import type {
  DetectedWorktree,
  DetectedWorktreeListResult,
  Worktree
} from '../../../../../../shared/worktree/types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host'
import { makeWorktree } from '../../../worktree-jump-palette-test-fixtures'
import { buildRows } from '../grouping/build-rows'
import { computeVisibleWorktrees } from '../../visible-worktrees'
import { useSidebarExternalWorktreeCards } from './use-external-worktree-cards'
import { scopePendingCreationsToTagFilter } from '../../workspace-tag-header-scope'

const initialState = useAppStore.getInitialState()

function repo(id: string, name: string, extra: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/repos/${name}`,
    displayName: name,
    badgeColor: '#000',
    addedAt: 0,
    externalWorktreeVisibility: 'hide',
    ...extra
  }
}

function detectedHidden(repoId: string): DetectedWorktree {
  return {
    ...makeWorktree(`${repoId}::/ext/${repoId}`, 'external', { repoId, path: `/ext/${repoId}` }),
    ownership: 'external',
    selectedCheckout: false,
    visible: false
  }
}

// Shaped like the reported sidebar: one tagged workspace in two projects, the rest only have
// hidden external worktrees (imported card), new-external inbox entries, or an in-flight create.
const gateway = repo('gateway', 'chatbot_gateway', { externalWorktreeVisibility: 'show' })
const admissions = repo('admissions', 'AdmissionsPlusWeb', { externalWorktreeVisibility: 'show' })
const notification = repo('notification', 'notification')
const executor = repo('executor', 'executor')
const webPlugin = repo('web-plugin', 'web_plugin_module')
const dialogApi = repo('dialog-api', 'dialog_api')
const untaggedOnly = repo('untagged', 'AVA', { externalWorktreeVisibility: 'show' })
const yapp = repo('yapp', 'yapp', { kind: 'folder' })
const repos = [
  yapp,
  gateway,
  admissions,
  notification,
  executor,
  webPlugin,
  dialogApi,
  untaggedOnly
]

const tagged = (id: string, repoId: string): Worktree =>
  makeWorktree(id, id, { repoId, tags: ['demo'] })
const worktreesByRepo = {
  gateway: [tagged('gw-1', 'gateway'), makeWorktree('gw-2', 'gw-2', { repoId: 'gateway' })],
  admissions: [tagged('ad-1', 'admissions')],
  notification: [makeWorktree('n-1', 'n-1', { repoId: 'notification' })],
  yapp: [],
  executor: [],
  'web-plugin': [makeWorktree('w-1', 'w-1', { repoId: 'web-plugin' })],
  'dialog-api': [makeWorktree('d-1', 'd-1', { repoId: 'dialog-api' })],
  untagged: [makeWorktree('a-1', 'a-1', { repoId: 'untagged' })]
}
const detectedWorktreesByRepo: Record<string, DetectedWorktreeListResult> = Object.fromEntries(
  ['notification', 'executor', 'web-plugin', 'dialog-api'].map((id) => [
    id,
    {
      repoId: id,
      authoritative: true,
      source: 'git',
      worktrees: [detectedHidden(id)]
    }
  ])
)
// Inbox candidates come from baseline-tracked, visible-but-unseen external worktrees.
const pending = [{ creationId: 'c1', repoId: 'untagged' }]

function visibleHeaders(filterTags: string[]): string[] {
  const repoMap = new Map(repos.map((r) => [r.id, r]))
  const visibleWorktrees = computeVisibleWorktrees(worktreesByRepo, [], {
    filterRepoIds: [],
    filterTags,
    showSleepingWorkspaces: true,
    tabsByWorktree: null,
    ptyIdsByTabId: null,
    worktreeIdsWithLiveAgent: new Set(),
    hideDefaultBranchWorkspace: false,
    hideAutomationGeneratedWorkspaces: false,
    hideCliCreatedWorkspaces: false,
    hideDetachedHeadWorkspaces: false,
    hideWorkspacesFromOtherDevices: false,
    pairedDeviceIdsByEnvironment: new Map(),
    repoMap,
    workspaceHostScope: 'all',
    defaultHostId: LOCAL_EXECUTION_HOST_ID,
    worktreeLineageById: {}
  })
  const { result } = renderHook(() =>
    useSidebarExternalWorktreeCards({
      repos,
      visibleReposForRows: repos,
      detectedWorktreesByRepo,
      filterRepoIds: [],
      filterTags,
      visibleWorktrees
    })
  )
  const rows = buildRows(
    'repo',
    visibleWorktrees,
    repoMap,
    null,
    new Set(),
    undefined,
    undefined,
    'manual',
    {},
    undefined,
    false,
    undefined,
    [],
    new Set(),
    result.current.importedWorktreesByRepo,
    result.current.newExternalWorktreesInboxByRepo,
    scopePendingCreationsToTagFilter(pending, visibleWorktrees, filterTags)
  )
  return rows.flatMap((row) => (row.type === 'header' ? [row.label] : []))
}

describe('tag filter and project headers', () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true)
  })
  afterEach(() => cleanup())

  it('without a tag filter keeps notice-only and pending-only project headers', () => {
    expect(visibleHeaders([]).sort()).toEqual(
      [
        'AVA',
        'AdmissionsPlusWeb',
        'chatbot_gateway',
        'dialog_api',
        'executor',
        'notification',
        'web_plugin_module'
      ].sort()
    )
  })

  it('with a tag filter renders only headers that have a matching workspace', () => {
    expect(visibleHeaders(['demo']).sort()).toEqual(['AdmissionsPlusWeb', 'chatbot_gateway'])
  })
})
