import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'
import {
  isSameAgentProcess,
  type AgentProcessVerdict
} from '../../../shared/agent-process-presence'
import { probeAgentProcessPresence } from '../../../shared/agent-process-presence-probe'
import { admitLegacyAgentStatus } from '../../../shared/agent-hook-listener/listener-state'
import { AGENT_STATUS_2A_CURRENT_PRODUCER_MODE } from '../../../shared/agent-status-legacy-adapter'
import type { EnrichedAgentHookEventPayload } from './server-types'
import { AgentHookServerLifecycle } from './server-lifecycle'

export abstract class AgentHookServerAgentPresence extends AgentHookServerLifecycle {
  private readonly presenceChecks = new WeakMap<
    AgentHookEventPayload,
    Promise<AgentProcessVerdict | null>
  >()

  /** A live hook proves its own process alive; only another process's hook casts doubt on the owner. */
  checkAgentPresenceAfterHook(event: AgentHookEventPayload, row: AgentHookEventPayload): void {
    const sender = event.agentPresence?.process
    const owner = row.agentPresence
    if (sender && owner?.process && !owner.ended && !isSameAgentProcess(sender, owner.process)) {
      void this.checkAgentPresence(row.paneKey, event.agentPresence)
    }
  }

  /** Whether this pane's owner carries a process identity that its execution host can check. */
  hasVerifiableAgentProcess(paneKey: string): boolean {
    const presence = this.state.lastStatusByPaneKey.get(
      this.resolvePaneKeyAlias(paneKey)
    )?.agentPresence
    return presence?.process !== undefined && !presence.ended
  }

  checkAgentPresence(
    paneKey: string,
    successor?: AgentHookEventPayload['agentPresence']
  ): Promise<AgentProcessVerdict | null> {
    const resolved = this.resolvePaneKeyAlias(paneKey)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: main admits enriched legacy rows; the shared view declares their base event type.
    const row = this.state.lastStatusByPaneKey.get(resolved) as
      | EnrichedAgentHookEventPayload
      | undefined
    // Why: an ended owner already published its exit, and an owner no hook identified cannot be checked.
    if (!row?.agentPresence?.process || row.agentPresence.ended) {
      return Promise.resolve(null)
    }
    if (row.connectionId !== null) {
      return Promise.resolve('unverifiable')
    }
    const pending = this.presenceChecks.get(row)
    if (pending) {
      return pending
    }
    const presence = row.agentPresence
    const check = probeAgentProcessPresence(presence.process)
      .then((verdict) => {
        if (
          this.state.lastStatusByPaneKey.get(resolved) !== row ||
          row.agentPresence !== presence
        ) {
          return 'unverifiable' as const
        }
        if (verdict === 'exited' && successor?.process && successor.agent === presence.agent) {
          // Why (fork): a resumed agent's hook proves a live process in a pane whose hydrated owner died with the reboot; hand over ownership so the pane stays resumable.
          const handedOver = {
            ...row,
            agentPresence: { agent: successor.agent, process: successor.process }
          }
          admitLegacyAgentStatus(
            this.state,
            'main-status-cleanup',
            handedOver,
            AGENT_STATUS_2A_CURRENT_PRODUCER_MODE
          )
          this.commitStatusRowMutation(row, handedOver)
          this.scheduleStatusPersist()
        } else if (verdict === 'exited') {
          this.reconcileEndedProcessForPaneKeys([resolved], {
            preserveResumeIdentity: true,
            endedPresence: { ...presence, ended: true }
          })
        }
        return verdict
      })
      .finally(() => {
        if (this.presenceChecks.get(row) === check) {
          this.presenceChecks.delete(row)
        }
      })
    this.presenceChecks.set(row, check)
    return check
  }
}
