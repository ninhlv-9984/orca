# Plan: workspace tags (fork feature)

Status: implemented on branch ninhlv-9984/workspace-tags (pending PR). Read with `GLOSSARY.md` (terms) and
`fork/adr/0001-workspace-tags-slim-patch-upstream-data-shape.md` (why this shape).
Interactive wireframe the user approved (v5): https://claude.ai/artifact/SiUwMiPvSAQXV2gkpbvP61
Upstream reference only (do NOT cherry-pick): stablyai/orca#22803 (spec), draft PR #22688.

## Goal

The user runs ~110 worktrees across 21 repos. Let them attach any number of
**tags** to a workspace (git worktree or folder workspace), filter the sidebar
to the tags they are working on, and let agents list/set tags from the CLI.

## Decided behavior (do not re-litigate)

- Tags are many-to-many and global (not per repo). A tag exists while ≥1 workspace carries it; no separate tag list.
- Tag rules: trimmed, matched case-insensitively (first-seen casing kept), ≤32 chars, no commas, deduped. Empty set is stored as absent, never `[]`.
- **Tag color**: picked at random from the least-used colors when a tag is first seen without a color (including tags created by agents via CLI); changeable later. Color stays keyed by lowercase name even after the tag disappears. Palette = existing workspace-status color ids minus neutral/conductor ones: `blue, sky, violet, amber, emerald, rose`.
- **Tag filter**: OR across selected tags. Persisted across restarts. Pinned workspaces are NOT exempt. Applies to the sidebar list and to workspace-jump shortcuts (Ctrl+1..9, next/prev); the Cmd+J palette and the kanban board are unaffected.
- **Filter UI**: a new row **Tags ›** in the existing "Workspace options" popover, right under **Projects ›**, whose panel mirrors the Projects filter panel (search + multi-select + per-tag count + color dot). Active tag filter counts toward the existing filter badge. When filtering, a thin strip under the sidebar header shows the active tags as colored chips with × and a visible/total count; hidden when not filtering. NO always-visible filter input.
- **Assigning tags in UI**: right-click a workspace → new **Tags ›** submenu right after **Status ›** (same submenu style): search-or-create input, checkbox per tag, a color dot per tag that opens the 6 swatches. Works on the single right-clicked workspace (multi-select is a nice-to-have, skip if costly).
- **Card chips**: tags render as small colored chips on the workspace card, toggled by a new Card display property (default on).
- **Inheritance**: a workspace created with a parent (`--parent-worktree` / lineage) copies the parent's tags.
- **Agent API**: `orca worktree set --worktree <sel> --tag X` (repeatable) / `--untag X` (repeatable) / `--tags a,b|null` (replace / clear); `orca worktree tags` (list name, color, count); `orca worktree ps --tag X` (repeatable, OR); `orca worktree tag-color --tag X --color Y`. `--tag/--untag` are applied host-side (add/remove), so concurrent agents don't overwrite each other.
- Out of scope: Group by Tag, tag rename/delete UI, mobile UI, `worktree.tags.v1` capability negotiation, remote/SSH-specific work beyond what the existing meta paths already carry.

## Code map (verified 2026-10-07 on v1.4.221; re-check line numbers)

Data:
- `src/shared/worktree/meta-types.ts` — `WorktreeMeta` (add `tags?: string[]` next to `workspaceStatus`).
- `src/shared/worktree/types.ts` — app-level `Worktree` (add `tags?`).
- Hand-written meta→Worktree projections (each needs `tags`): `src/main/ipc/worktree-metadata-merge.ts`, `src/main/ipc/worktrees/folder-workspace-model.ts`, `src/main/runtime/runtime-folder-workspace.ts`, `src/main/runtime/runtime-worktree-ps-summaries.ts`.
- Persist/merge: `src/main/persistence/loading-store/metadata-lineage-operations.ts` (`setWorktreeMeta`), `worktree-meta-write-normalization.ts` (`mergeWorktreeMetaForWrite`), `src/shared/worktree/meta-persisted-defaults.ts` (omit absent tags).
- New module: `src/shared/worktree/worktree-tags.ts` — normalize/validate/dedupe/match/add/remove helpers + tests.
- Tag colors: persisted UI state (`src/shared/persisted-ui-state-types.ts`, register in `persisted-ui-write-baseline.ts`), field e.g. `worktreeTagColors: Record<string, string>`. Written by renderer through `window.api.ui.set` and by CLI through the existing `ui.set` RPC (`src/main/runtime/rpc/methods/client-ui.ts`; `UiUpdate` schema in `client-ui-schemas.ts` is STRICT — add the field there and satisfy `ui-state-schema-parity*.ts`). Color ids/helpers: `src/shared/workspace-statuses.ts` (`WORKSPACE_STATUS_COLOR_IDS`).

API / CLI:
- RPC `worktree.set`: `src/main/runtime/rpc/methods/worktree.ts` → `runtime.updateManagedWorktreeMeta` (`src/main/runtime/runtime-managed-worktree-metadata.ts`); params zod `WorktreeSet` in `src/shared/rpc-contract/worktree-params.ts` — add `tags`, `addTags`, `removeTags`; apply add/remove against the current host value inside the runtime.
- Renderer write path: `src/renderer/src/store/slices/worktrees/metadata/update-worktree-meta.ts` → `worktree-meta-persist.ts` (local IPC `worktrees:updateMeta`, remote `worktree.set`).
- Inheritance: `src/main/runtime/orca-runtime-create-managed-worktree.ts` (lineage/parentWorktreeId ~L157/L277) and `orca-runtime-create-managed-remote-worktree.ts`.
- `worktree ps` / `list` / `show`: `src/main/runtime/rpc/methods/worktree-catalog-methods.ts`.
- CLI: specs `src/cli/specs/worktree-set.ts` (+ new `worktree-tags.ts`, `worktree-tag-color.ts`, `--tag` on ps spec); unknown flags rejected via `allowedFlags` (`src/cli/args.ts`); handlers `src/cli/handlers/worktree.ts`; help `src/cli/command-scoped-flag-help.ts`; tests like `src/cli/index-worktree-set.test.ts`.
- Generated: `pnpm generate:rpc-params-catalog` (→ `src/shared/rpc-contract/rpc-params-catalog.generated.ts`).
- Agent guide: `skill-guides/orca-cli.md` (worktree set examples ~L88–94, comment/status guidance ~L139–147) → `pnpm generate:bundled-skill-guides` (writes `src/cli/bundled-skill-guides.ts`, `skills/orca-cli/SKILL.md` from `skill-stubs/orca-cli.md`).

Renderer UI (reuse, don't invent — see `docs/STYLEGUIDE.md`, `src/renderer/src/components/ui/`, tokens in `src/renderer/src/assets/main.css`):
- Visible list: `src/renderer/src/components/sidebar/visible-worktrees.ts` (`computeVisibleWorktrees` ~L91, repo filter ~L143, shortcut targets ~L278/L338), `worktree-list/listing/use-visible-worktrees.ts`.
- Filter state: UI slice setters `src/renderer/src/store/slices/ui/ui-slice-preference-actions.ts`; mirror `filterRepoIds` for a new persisted `filterTags`. Also `sidebar-filter-actions.ts` (clear/active), `visible-worktree-options-from-state.ts`.
- Workspace options popover: `SidebarWorkspaceOptionsMenu.tsx`, `workspace-options-menu-items.tsx` (badge count `activeFilterCount` ~L42–82). Model the Tags panel on `SidebarProjectFilterPanel.tsx` (Command/CommandInput/CommandItem) and `SidebarRepositoryFilterSection.tsx`.
- Right-click menu: `WorktreeContextMenuView.tsx` (renders `<WorktreeStatusMenuItems …>` ~L166); new `WorktreeTagMenuItems.tsx` modeled on `WorktreeStatusMenuItems.tsx` (DropdownMenuSub/SubTrigger/SubContent).
- Card chips: card display properties `src/shared/ui-chrome-types.ts` (`worktreeCardProperties`), `worktree-card-display-property-options.ts`.
- All UI strings through `translate('…', 'English')`; lint runs `verify:localization-catalogs/extraction/coverage`.

## Execution protocol (user's instructions)

- The main session (Opus) orchestrates; **implementation and review are delegated to subagents on Sonnet** (`Agent` with `model: "sonnet"`), each with a self-contained prompt pointing at this plan.
- Work happens in a **new Orca worktree** off `ninh/patches` (create with `orca-ide worktree create` so it shows in Orca; branch `ninhlv-9984/workspace-tags` (Orca prefixes the GitHub user), worktree `~/orca/workspaces/orca/workspace-tags`), and ships as a **PR into `ninh/patches` on the fork**: `gh pr create -R ninhlv-9984/orca --base ninh/patches` — ALWAYS pass `-R ninhlv-9984/orca`, otherwise gh targets upstream stablyai/orca.
- Never push to `ninh/patches` directly; merge via the PR after the user approves.
- Suggested slices, each = one subagent implement → one subagent review → fix → orchestrator verifies:
  1. `docs`: commit `GLOSSARY.md`, `fork/adr/0001-…`, this plan.
  2. `data+API+CLI+guide`: sections Data + API/CLI above, with tests; regenerate catalog + bundled guides.
  3. `UI`: filter state + options-menu Tags panel + strip + context submenu + chips + colors, with tests.
  4. `fork/orca-rebuild.sh`: run the tests of every file touched by fork commits (`git diff --name-only <base-tag>..HEAD`) instead of the hardcoded list.
- Reviewer subagent checks against this plan + AGENTS.md rules (reuse, concise comments, no `as` casts without SAFETY, no max-lines disables, cross-platform, translate()).

## Verification (each slice)

- `export PATH=$HOME/.local/bin:$PATH` (pnpm via corepack). Deps: `pnpm install --frozen-lockfile` at root AND in `mobile/`. Bun is not installed: run tests with `pnpm exec vitest run --config config/vitest.config.ts <paths>`.
- `pnpm tc`, `pnpm run check:code-quality:changed`, `pnpm generate:rpc-params-catalog && pnpm verify:rpc-params-catalog`, `pnpm verify:bundled-skill-guides`, localization verifies; pre-commit runs oxlint + oxfmt.
- Never launch the real app on the user's profile from an agent. Any app launch: `ORCA_BACKGROUND_LAUNCH=1`, isolated `--user-data-dir` with a SHORT path (e.g. `~/.cache/osmk`; long paths break the daemon socket, EINVAL).
- After the PR merges: `orca-rebuild` (builds .deb with `ORCA_FORK_SKIP_GLIBC_FLOOR=1`, installs to /opt/Orca); user restarts Orca and tests.
