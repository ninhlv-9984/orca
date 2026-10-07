import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'
import { WORKSPACE_TAG_COLOR_IDS } from '../../shared/worktree/worktree-tags'

export const WORKTREE_TAG_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['worktree', 'tags'],
    summary: 'List every workspace tag with its color and workspace count',
    usage: 'orca worktree tags [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Lists tags carried by at least one workspace, sorted by name. Reuse an existing tag instead of inventing a near-duplicate.'
    ],
    examples: ['orca worktree tags --json']
  },
  {
    path: ['worktree', 'tag-color'],
    summary: 'Set the color of a workspace tag',
    usage: `orca worktree tag-color --tag <name> --color <${WORKSPACE_TAG_COLOR_IDS.join('|')}> [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'tag', 'color'],
    notes: [
      'Tag colors are picked automatically when a tag is first used; use this only to change one.'
    ],
    examples: ['orca worktree tag-color --tag backend --color emerald --json']
  }
]
