import { describe, expect, it, vi } from 'vitest'
import { bindBuildColdRestoreAgentResumeStartup } from './cold-restore-resume-startup'
import type { ConnectPanePtySession } from './connect-pane-pty-session'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return { state }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))

const WORKTREE_ID = 'repo-1::/workspaces/wt-1'

type EntryOverrides = Record<string, unknown>

function entry(paneKey: string, overrides: EntryOverrides = {}): Record<string, unknown> {
  return {
    paneKey,
    state: 'done',
    agentType: 'claude',
    prompt: '',
    updatedAt: Date.now(),
    stateStartedAt: 1,
    providerSession: { key: 'session_id', id: 'claude-sess-1' },
    worktreeId: WORKTREE_ID,
    ...overrides
  }
}

function setStore(
  entries: Record<string, Record<string, unknown>>,
  records: Record<string, unknown> = {}
): void {
  mocks.state = {
    agentStatusByPaneKey: entries,
    sleepingAgentSessionsByPaneKey: records,
    settings: {},
    getAgentLaunchConfigForStatusEntry: () => undefined,
    runtimeStatusByEnvironmentId: new Map(),
    tabsByWorktree: {},
    repos: [],
    worktreesByRepo: {}
  }
}

function buildSession(
  paneKey: string,
  overrides: Record<string, unknown> = {}
): ConnectPanePtySession {
  const bag = {
    cacheKey: paneKey,
    deps: { worktreeId: WORKTREE_ID },
    pendingStartupCommand: null,
    executionHostId: 'local',
    connectionId: null,
    projectRuntime: undefined,
    shellOverride: undefined,
    worktree: { path: '/workspaces/wt-1' },
    getSleepingRecordForPane: (state: {
      sleepingAgentSessionsByPaneKey: Record<string, unknown>
    }) =>
      state.sleepingAgentSessionsByPaneKey[paneKey]
        ? { paneKey, record: state.sleepingAgentSessionsByPaneKey[paneKey] }
        : null,
    ...overrides
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test bag covers every member the builder reads.
  const session = bag as unknown as ConnectPanePtySession
  bindBuildColdRestoreAgentResumeStartup(session)
  return session
}

function sleepingRecord(paneKey: string, id: string): Record<string, unknown> {
  return {
    paneKey,
    worktreeId: WORKTREE_ID,
    agent: 'claude',
    providerSession: { key: 'session_id', id },
    state: 'done',
    origin: 'worktree-sleep',
    capturedAt: 1,
    updatedAt: 1,
    prompt: ''
  }
}

describe('cold restore of an idle (done) agent', () => {
  it('resumes a done claude entry by exact session id', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1') })
    const startup = buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()
    expect(startup?.command).toContain('claude')
    expect(startup?.command).toMatch(/'?--resume'? '?claude-sess-1'?/)
    expect(startup?.resumeProviderSession).toEqual({ key: 'session_id', id: 'claude-sess-1' })
    expect(startup?.hasSleepingRecord).toBe(false)
  })

  it('resumes a done codex entry with `codex resume <id>`', () => {
    setStore({
      'tab-1:leaf-1': entry('tab-1:leaf-1', {
        agentType: 'codex',
        providerSession: { key: 'session_id', id: 'codex-sess-1' }
      })
    })
    const startup = buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()
    expect(startup?.command).toContain('codex')
    expect(startup?.command).toMatch(/'?resume'? '?codex-sess-1'?/)
  })

  it('still resumes a working entry', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1', { state: 'working' }) })
    const startup = buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()
    expect(startup?.command).toMatch(/'?--resume'? '?claude-sess-1'?/)
    expect(startup?.useLiveEntry).toBe(true)
  })

  it('does not resume an exited agent (no status row, only a hidden remnant)', () => {
    setStore({})
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
  })

  it('does not resume a done entry without a provider session id', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1', { providerSession: undefined }) })
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
  })

  it('does not resume a done entry marked not terminal-resumable', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1', { terminalResumeEligible: false }) })
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
  })

  it('does not resume a done entry that names another execution host', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1', { connectionId: 'ssh-target-1' }) })
    expect(
      buildSession('tab-1:leaf-1', {
        executionHostId: 'local'
      }).buildColdRestoreAgentResumeStartup()
    ).toBeNull()
  })

  it('resumes a provider session in only one of two panes holding it, newest row first', () => {
    const now = Date.now()
    setStore({
      'tab-1:leaf-1': entry('tab-1:leaf-1', { updatedAt: now - 1000 }),
      'tab-2:leaf-1': entry('tab-2:leaf-1', { updatedAt: now })
    })
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
    expect(buildSession('tab-2:leaf-1').buildColdRestoreAgentResumeStartup()).not.toBeNull()
    expect(buildSession('tab-2:leaf-1').buildColdRestoreAgentResumeStartup()).not.toBeNull()
  })

  it('skips a done row whose session a live row on another pane already runs', () => {
    setStore({
      'tab-1:leaf-1': entry('tab-1:leaf-1'),
      'tab-2:leaf-1': entry('tab-2:leaf-1', { state: 'working' })
    })
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
  })

  it('skips a done row whose session a sleeping record on another pane holds', () => {
    setStore(
      { 'tab-1:leaf-1': entry('tab-1:leaf-1') },
      { 'tab-2:leaf-1': sleepingRecord('tab-2:leaf-1', 'claude-sess-1') }
    )
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
  })

  it('treats pi transcripts as distinct sessions', () => {
    const base = { agentType: 'pi' }
    setStore({
      'tab-1:leaf-1': entry('tab-1:leaf-1', {
        ...base,
        providerSession: { key: 'session_id', id: 's', transcriptPath: '/a.jsonl' }
      }),
      'tab-2:leaf-1': entry('tab-2:leaf-1', {
        ...base,
        providerSession: { key: 'session_id', id: 's', transcriptPath: '/b.jsonl' }
      })
    })
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).not.toBeNull()
    expect(buildSession('tab-2:leaf-1').buildColdRestoreAgentResumeStartup()).not.toBeNull()
  })

  it('does not resume a done row older than three days', () => {
    setStore({
      'tab-1:leaf-1': entry('tab-1:leaf-1', { updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000 })
    })
    expect(buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()).toBeNull()
  })

  it('does not resume a local row in an ssh pane, but resumes a matching ssh row', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1', { connectionId: null }) })
    expect(
      buildSession('tab-1:leaf-1', {
        executionHostId: 'ssh:t1'
      }).buildColdRestoreAgentResumeStartup()
    ).toBeNull()
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1', { connectionId: 't1' }) })
    expect(
      buildSession('tab-1:leaf-1', {
        executionHostId: 'ssh:t1'
      }).buildColdRestoreAgentResumeStartup()
    ).not.toBeNull()
  })

  it('leaves a pane with a sleeping record on the record path', () => {
    setStore(
      { 'tab-1:leaf-1': entry('tab-1:leaf-1') },
      {
        'tab-1:leaf-1': {
          paneKey: 'tab-1:leaf-1',
          worktreeId: WORKTREE_ID,
          agent: 'claude',
          providerSession: { key: 'session_id', id: 'record-sess' },
          state: 'done',
          origin: 'worktree-sleep',
          capturedAt: 1,
          updatedAt: 1,
          prompt: ''
        }
      }
    )
    const startup = buildSession('tab-1:leaf-1').buildColdRestoreAgentResumeStartup()
    expect(startup?.command).toMatch(/'?--resume'? '?record-sess'?/)
    expect(startup?.hasSleepingRecord).toBe(true)
  })

  it('returns null while a startup command is pending', () => {
    setStore({ 'tab-1:leaf-1': entry('tab-1:leaf-1') })
    expect(
      buildSession('tab-1:leaf-1', {
        pendingStartupCommand: { command: 'ls' }
      }).buildColdRestoreAgentResumeStartup()
    ).toBeNull()
  })
})
