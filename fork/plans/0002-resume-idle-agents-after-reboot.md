# Plan: resume idle agents after a reboot (fork feature)

Status: approved scope, in progress on branch `ninhlv-9984/resume-done-agents`.

## Goal

After the machine reboots (terminal daemon dead) and Orca reopens, every terminal pane that was
running a CLI agent comes back running that **exact** agent session, including agents that had
finished their turn and were waiting for input. This replaces the user's external
`~/.local/bin/orca-launch` + `orca-resume-claude` scripts (`claude -c` by directory, Codex rollout
scan), which get removed once this ships.

## What upstream already does (v1.4.224)

- Hook payloads carry the provider session id (`extractAgentProviderSession`,
  `src/shared/agent-session-resume.ts`); the hook-server store keeps it per pane and mirrors it to
  `<userData>/agent-hooks/last-status.json` (hydrated on startup, 7-day TTL).
- The renderer captures non-`done` agents into `workspaceSession.sleepingAgentSessionsByPaneKey`
  on quit and every 60s (`agent-status-recovery-actions.ts`), and cold restore relaunches them with
  `claude --resume <id>` / `codex resume <id>` etc.
  (`cold-restore-resume-startup.ts`, `buildAgentResumeStartupPlan`).
- Gap: entries in state `done` (an idle REPL waiting for the user — the common case) are skipped in
  both places, so those panes come back as bare shells.

## Decided behavior (user, 2026-10-11)

- Idle (`done`) agent panes are **resumed automatically** on cold restore, by exact session id. No
  setting, no prompt (resuming an idle REPL spends nothing until the user types).
- **Only by session id**: no per-directory fallback (`claude -c`, rollout scan). A pane without a
  recorded id stays a bare shell with its scrollback, as today.
- **No** launch-at-login option.
- Unchanged: warm reattach (daemon alive) never relaunches anything; a pane whose shell is still
  live is never resumed over; host scoping (`sleeping-record-execution-host-scope.ts`) still blocks
  replaying an id on another host; duplicate panes for one provider session resume once.
- An agent the user deliberately exited (e.g. `/exit`, Ctrl+D back to the shell) must NOT be
  resurrected. Distinguish "idle but alive at shutdown" from "exited" with whatever signal the code
  already has (SessionEnd hook / cleared entry / pane foreground process); if no reliable signal
  exists, document the limitation.

## After merge

`orca-rebuild`; then point `~/.local/share/applications/orca-ide.desktop` back at `orca` and delete
`~/.local/bin/orca-launch` and `~/.local/bin/orca-resume-claude`.

## Findings and implementation (2026-10-11)

Trace on a reboot (daemon dead, cold restore):

- (a) working: the renderer holds a non-`done` status row; `captureAllSleepingAgentSessions` records it
  on quit / every 60s, and `buildColdRestoreAgentResumeStartup` resumes it. Unchanged.
- (b) idle (`done`, agent still running): the hook-server row survives in `last-status.json` and is
  hydrated back (no `providerSessionOnly`). Upstream skipped it in capture and in the builder
  (`useLiveEntry = entry.state !== 'done'`), so the pane came back as a bare shell.
- (c) exited to shell: Claude `SessionEnd` (exit reasons), the process-presence probe, or a row
  dismissal replaces the row with a `providerSessionOnly` remnant (`server-cleanup.ts`
  `toRetainedProviderSessionRow`, `reconcileEndedProcessForPaneKeys`). The renderer drops that
  remnant for every agent except pi (`agent-status-event-applicator.ts`), so no status row exists.
  Verified in `last-status.json`: exited panes carry `providerSessionOnly: true` + `ended: true`,
  idle live panes do not.

Signal: "a `done` status row exists in the renderer at cold restore" == agent was alive at shutdown.

Design: let the cold-restore builder use a `done` row when the pane has no sleeping record
(`idle-agent-cold-restore-entry.ts`), rather than capturing `done` into sleeping records. Capturing
would feed hibernation / wake-in-background / worktree-sleep and the 60s live capture (which would
then resurrect agents the user exited, since records are not cleared by the hook remnant). A record
still wins when present, so those flows are unchanged. One resume per provider session is enforced
by an in-memory claim keyed by agent + session id.

Limits: an agent exited while Orca was closed (no hook server to drop the row), an agent whose
provider emits no exit signal, or a row dismissed from the dashboard while the agent still ran, can
be wrongly resumed / not resumed; rows older than the 7-day hydration TTL are gone.
