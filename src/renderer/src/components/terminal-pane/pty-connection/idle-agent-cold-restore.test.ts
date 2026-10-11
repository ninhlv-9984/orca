import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bindBuildColdRestoreAgentResumeStartup } from './cold-restore-resume-startup'
import { resetIdleAgentSessionClaimsForTests } from './idle-agent-cold-restore-entry'
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
    updatedAt: 1,
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

describe('cold restore of an idle (done) agent', () => {
  beforeEach(() => {
    resetIdleAgentSessionClaimsForTests()
  })

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

  it('resumes a provider session in only one of two panes holding it', () => {
    setStore({
      'tab-1:leaf-1': entry('tab-1:leaf-1'),
      'tab-2:leaf-1': entry('tab-2:leaf-1')
    })
    const first = buildSession('tab-1:leaf-1')
    const second = buildSession('tab-2:leaf-1')
    expect(first.buildColdRestoreAgentResumeStartup()).not.toBeNull()
    expect(second.buildColdRestoreAgentResumeStartup()).toBeNull()
    // The builder runs repeatedly per pane while it reconnects; the owner keeps its claim.
    expect(first.buildColdRestoreAgentResumeStartup()).not.toBeNull()
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
