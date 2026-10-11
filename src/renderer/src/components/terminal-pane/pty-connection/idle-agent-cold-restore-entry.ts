import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import {
  isResumableTuiAgent,
  type SleepingAgentSessionRecord
} from '../../../../../shared/agent-session-resume'
import { getProviderSessionClaimKey } from '@/lib/sleeping-agent-pane-ownership'

// Why: hydrated rows without process presence can never be invalidated by a probe, so age is the only bound.
export const IDLE_ROW_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

type IdleResumeState = {
  agentStatusByPaneKey: Record<string, AgentStatusEntry>
  sleepingAgentSessionsByPaneKey: Record<string, SleepingAgentSessionRecord>
}

function claimKeyFor(entry: AgentStatusEntry, worktreeId: string): string | null {
  if (!entry.providerSession || !isResumableTuiAgent(entry.agentType)) {
    return null
  }
  return getProviderSessionClaimKey({
    paneKey: entry.paneKey,
    worktreeId,
    agent: entry.agentType,
    providerSession: entry.providerSession,
    prompt: entry.prompt,
    state: entry.state,
    capturedAt: entry.updatedAt,
    updatedAt: entry.updatedAt
  })
}

/**
 * A `done` row that survives to cold restore is an agent idle but alive at shutdown: a user exit
 * leaves only a providerSessionOnly remnant the renderer never stores. No per-directory fallback.
 */
export function selectIdleAgentEntryForColdRestore(args: {
  entry: AgentStatusEntry | undefined
  paneKey: string
  worktreeId: string
  state: IdleResumeState
  now: number
}): AgentStatusEntry | null {
  const { entry, paneKey, worktreeId, state, now } = args
  if (
    !entry ||
    entry.state !== 'done' ||
    entry.terminalResumeEligible === false ||
    now - entry.updatedAt > IDLE_ROW_MAX_AGE_MS
  ) {
    return null
  }
  const key = claimKeyFor(entry, entry.worktreeId ?? worktreeId)
  if (!key) {
    return null
  }
  // Why: another pane's record or live row already owns this session.
  for (const record of Object.values(state.sleepingAgentSessionsByPaneKey)) {
    if (record.paneKey !== paneKey && getProviderSessionClaimKey(record) === key) {
      return null
    }
  }
  for (const other of Object.values(state.agentStatusByPaneKey)) {
    if (other.paneKey === paneKey || claimKeyFor(other, other.worktreeId ?? worktreeId) !== key) {
      continue
    }
    // Why: stateless owner choice (newest row, then pane key) keeps resume to one pane per session.
    const otherWins =
      other.state !== 'done' ||
      other.updatedAt > entry.updatedAt ||
      (other.updatedAt === entry.updatedAt && other.paneKey < paneKey)
    if (otherWins) {
      return null
    }
  }
  return entry
}
