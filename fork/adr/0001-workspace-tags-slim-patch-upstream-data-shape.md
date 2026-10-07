---
status: accepted
---

# Workspace tags: our own slim patch, upstream's data shape

Upstream has an open proposal for workspace tags (stablyai/orca#22803) with a draft implementation (#22688, about 4.3k lines over 181 files, unreviewed and already conflicting with main). This fork needs tags now, and every fork patch is rebased onto each upstream release, so we build a small patch of our own instead of carrying #22688. We still store and expose tags exactly as #22803 does: an optional `tags` list on the worktree metadata (absent when empty), `--tag` / `--untag` / `--tags a,b|null` on `orca worktree set`, and case-insensitive matching. If upstream ships tags, we drop our patch and the tags users already set keep working.

## Considered Options

- **Cherry-pick #22688**: complete feature now, but a large rebase surface that conflicts on every release, and likely to diverge from whatever upstream finally merges.
- **Own design and own storage**: free to shape it, but the data would need migrating, or would be lost, once upstream ships its own tags.

## Consequences

- Tag rules (trim, case-insensitive, at most 32 characters, no commas) follow #22803. Changing them later means migrating stored tags.
- One deliberate addition over #22803: each tag has a color, picked at random (from the least-used workspace-status colors) when the tag is created and changeable from the Tags submenu or the CLI. Colors live in a separate name→color map, not on the workspace, so the per-workspace `tags` data stays exactly #22803's shape and an upstream switch only loses the colors.
- Out of scope compared with #22803: Group by Tag, tag rename/delete in the UI, the mobile UI, and the `worktree.tags.v1` capability check for older remote runtimes.
