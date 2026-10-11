import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import { isResumableTuiAgent } from '../../../../../shared/agent-session-resume'

// Why: two panes can hold the same provider session (e.g. a duplicated tab); resuming it in both
// would run one transcript twice. The first pane to claim it keeps it, and the claim is idempotent
// because the builder runs several times per pane while it reconnects.
const claimedByPaneKey = new Map<string, string>()

function claimKey(entry: AgentStatusEntry): string | null {
  const session = entry.providerSession
  if (!session) {
    return null
  }
  const transcript = entry.agentType === 'pi' ? (session.transcriptPath ?? '') : ''
  return `${entry.agentType}\0${session.key}\0${session.id}\0${transcript}`
}

/**
 * A `done` status row that survived to cold restore is an agent that was idle but still running at
 * shutdown: the hook server turns an exited agent (SessionEnd, process probe, dismissal) into a
 * providerSessionOnly remnant, which the renderer never stores as a status row. Returns the row
 * only when it names an exact provider session; there is deliberately no per-directory fallback.
 */
export function selectIdleAgentEntryForColdRestore(
  entry: AgentStatusEntry | undefined
): AgentStatusEntry | null {
  if (
    !entry ||
    entry.state !== 'done' ||
    entry.terminalResumeEligible === false ||
    !entry.providerSession ||
    !isResumableTuiAgent(entry.agentType)
  ) {
    return null
  }
  return entry
}

export function claimIdleAgentSessionForPane(entry: AgentStatusEntry, paneKey: string): boolean {
  const key = claimKey(entry)
  if (!key) {
    return false
  }
  const owner = claimedByPaneKey.get(key)
  if (owner !== undefined && owner !== paneKey) {
    return false
  }
  claimedByPaneKey.set(key, paneKey)
  return true
}

export function resetIdleAgentSessionClaimsForTests(): void {
  claimedByPaneKey.clear()
}
