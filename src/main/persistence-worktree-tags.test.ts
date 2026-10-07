import { closeTestStores, testState, createStore } from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Stub the ~/.ssh/config parser so the SSH-import test drives the real Store with deterministic hosts, not the operator's actual ~/.ssh/config.
const { loadUserSshConfigMock, sshConfigHostsToTargetsMock } = vi.hoisted(() => ({
  loadUserSshConfigMock: vi.fn(),
  sshConfigHostsToTargetsMock: vi.fn()
}))

vi.mock('./ssh/ssh-config-parser', () => ({
  loadUserSshConfig: loadUserSshConfigMock,
  sshConfigHostsToTargets: sshConfigHostsToTargetsMock
}))
const { trackMock, getCohortAtEmitMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  getCohortAtEmitMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`encrypted:${plaintext}`, 'utf-8'),
    decryptString: (ciphertext: Buffer) => {
      const decoded = ciphertext.toString('utf-8')
      if (!decoded.startsWith('encrypted:')) {
        throw new Error('invalid ciphertext')
      }
      return decoded.slice('encrypted:'.length)
    }
  }
}))

vi.mock('./telemetry/client', () => ({
  track: trackMock
}))

vi.mock('./telemetry/cohort-classifier', () => ({
  getCohortAtEmit: getCohortAtEmitMock
}))

describe('workspace tags persistence', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
    trackMock.mockReset()
    getCohortAtEmitMock.mockReset()
    getCohortAtEmitMock.mockReturnValue({ nth_repo_added: 2 })
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('normalizes worktree tags on write and stores an empty set as absent', async () => {
    const store = await createStore()
    expect(store.setWorktreeMeta('wt1', { tags: [' Api ', 'api', 'a,b', 'web'] }).tags).toEqual([
      'Api',
      'web'
    ])
    const cleared = store.setWorktreeMeta('wt1', { tags: [] })
    expect(cleared).not.toHaveProperty('tags')
    expect(store.getWorktreeMeta('wt1')).not.toHaveProperty('tags')
    store.setWorktreeMeta('wt2', { comment: 'no tags' })
    expect(store.getWorktreeMeta('wt2')).not.toHaveProperty('tags')
  })

  it('keeps worktree tags across a restart', async () => {
    const store = await createStore()
    store.setWorktreeMeta('wt1', { tags: ['api'] })
    store.flush()
    const reloaded = await createStore()
    expect(reloaded.getWorktreeMeta('wt1')?.tags).toEqual(['api'])
  })

  it('merges tag colors instead of replacing them and keeps them without carriers', async () => {
    const store = await createStore()
    const listener = vi.fn()
    store.onUIChanged(listener)
    store.updateUI({ worktreeTagColors: { api: 'blue' } })
    store.updateUI({ worktreeTagColors: { web: 'rose' } })
    expect(store.getUI().worktreeTagColors).toEqual({ api: 'blue', web: 'rose' })
    expect(listener).toHaveBeenCalledTimes(2)
    store.updateUI({ sidebarWidth: 410 })
    expect(store.getUI().worktreeTagColors).toEqual({ api: 'blue', web: 'rose' })
    store.flush()
    const reloaded = await createStore()
    expect(reloaded.getUI().worktreeTagColors).toEqual({ api: 'blue', web: 'rose' })
  })

  it('drops invalid tag colors on update', async () => {
    const store = await createStore()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: deliberately invalid input to prove it is dropped.
    store.updateUI({ worktreeTagColors: { Api: 'blue', web: 'neutral' } as never })
    expect(store.getUI().worktreeTagColors).toEqual({ api: 'blue' })
  })

  it('stores normalized tags on folder workspaces and clears them when emptied', async () => {
    const store = await createStore()
    const group = store.createProjectGroup({
      name: 'Platform',
      parentPath: '/workspace/platform',
      createdFrom: 'folder-scan'
    })
    const workspace = store.createFolderWorkspace({ projectGroupId: group.id, name: 'Docs' })
    expect(store.updateFolderWorkspace(workspace.id, { tags: ['Docs', 'docs', ''] })?.tags).toEqual(
      ['Docs']
    )
    expect(store.updateFolderWorkspace(workspace.id, { tags: [] })).not.toHaveProperty('tags')
  })
})
